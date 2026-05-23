'use client';

import React, { useState, useRef, useEffect } from 'react';
import { apiFetch } from '@/lib/api';
import { getGroupId } from '@/lib/group';

interface FormItem {
  formId: number;
  formName: string;
  description?: string;
  paymentType: string;
  fields: string[];
  generatedFields?: string[];
  createdAt: string;
  fileName?: string;
  active?: boolean;
}

interface RecentReport {
  evidenceId: number;
  title: string;
  createdAt: string;
  fileType: string | null;
  itemCount: number | null;
}

const EXT_COLORS: Record<string, { bg: string; color: string }> = {
  PDF:  { bg: 'var(--red-bg)',     color: 'var(--red)'  },
  DOC:  { bg: '#E8F0FF',           color: '#2B5CC8'     },
  DOCX: { bg: '#E8F0FF',           color: '#2B5CC8'     },
  HWP:  { bg: 'var(--blue-pale)',  color: 'var(--blue)' },
  HWPX: { bg: 'var(--blue-pale)',  color: 'var(--blue)' },
};

function getExt(name: string) {
  const ext = name.split('.').pop()?.toUpperCase() ?? '';
  return ext.length <= 4 ? ext : '';
}

function formatDate(dateStr: string) {
  return dateStr.slice(0, 10).replace(/-/g, '.');
}

export default function FormsPage() {
  const [forms, setForms] = useState<FormItem[]>([]);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [editTarget, setEditTarget] = useState<FormItem | null>(null);
  const [editName, setEditName] = useState('');
  const [editSaving, setEditSaving] = useState(false);
  const [reports, setReports] = useState<RecentReport[]>([]);
  const [downloading, setDownloading] = useState<number | null>(null);

  useEffect(() => { loadForms(); loadReports(); }, []);

  async function loadReports() {
    try {
      const groupId = getGroupId();
      const res = await apiFetch(`/api/evidence/list?status=approved${groupId ? `&groupId=${groupId}` : ''}`);
      if (res.ok) setReports(await res.json());
    } catch { /* 빈 상태 유지 */ }
  }

  async function handleReportDownload(evidenceId: number) {
    setDownloading(evidenceId);
    try {
      const res = await apiFetch(`/api/evidence/${evidenceId}/complete`, { method: 'POST', body: JSON.stringify({ forms: [] }) });
      if (res.ok) {
        const blob = await res.blob();
        const cd = res.headers.get('content-disposition') ?? '';
        const mStar = cd.match(/filename\*=UTF-8''([^;]+)/i);
        const mPlain = cd.match(/filename="?([^";]+)"?/i);
        const filename = mStar ? decodeURIComponent(mStar[1]) : (mPlain?.[1] ?? `문서_${evidenceId}`);
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url; a.download = filename; a.click();
        URL.revokeObjectURL(url);
      }
    } catch { /* 무시 */ }
    finally { setDownloading(null); }
  }

  async function loadForms() {
    try {
      const groupId = getGroupId();
      const res = await apiFetch(`/api/forms${groupId ? `?groupId=${groupId}` : ''}`);
      if (res.ok) setForms(await res.json());
    } catch { /* 빈 상태 유지 */ }
  }

  async function uploadFile(file: File) {
    setUploading(true); setError('');
    try {
      const fd = new FormData();
      fd.append('file', file);
      fd.append('formName', file.name.replace(/\.[^.]+$/, ''));
      fd.append('paymentType', 'BOTH');
      const groupId = getGroupId();
      if (groupId) fd.append('groupId', String(groupId));
      const res = await apiFetch('/api/forms/upload', { method: 'POST', body: fd });
      if (res.ok) {
        const data: FormItem = await res.json();
        setForms(prev => [data, ...prev]);
      } else {
        const body = await res.json().catch(() => null);
        setError(body?.error ?? '업로드에 실패했습니다.');
      }
    } catch { setError('서버에 연결할 수 없습니다.'); }
    finally { setUploading(false); }
  }

  async function handleDelete(formId: number) {
    if (!confirm('양식지를 삭제하시겠습니까?')) return;
    const res = await apiFetch(`/api/forms/${formId}`, { method: 'DELETE' });
    if (res.status === 204 || res.ok) setForms(prev => prev.filter(f => f.formId !== formId));
  }

  async function handleEditSave() {
    if (!editTarget || !editName.trim()) return;
    setEditSaving(true);
    try {
      const res = await apiFetch(`/api/forms/${editTarget.formId}`, {
        method: 'PUT',
        body: JSON.stringify({ formName: editName.trim() }),
      });
      if (res.ok) {
        const updated: FormItem = await res.json();
        setForms(prev => prev.map(f => f.formId === updated.formId ? updated : f));
        setEditTarget(null);
      }
    } finally { setEditSaving(false); }
  }

  return (
    <div style={{ fontFamily: 'var(--font-ui)', padding: 32, color: 'var(--navy)' }}>
      <div style={{ marginBottom: 24 }}>
        <div style={{ fontSize: 20, fontWeight: 700, color: 'var(--navy)', marginBottom: 4 }}>양식지</div>
        <div style={{ fontSize: 13, color: 'var(--gray4)' }}>지출결의에 사용할 양식지를 업로드하고 관리합니다</div>
      </div>

      <input
        ref={fileInputRef}
        type="file"
        accept=".pdf,.doc,.docx,.hwp,.hwpx,.xls,.xlsx"
        style={{ display: 'none' }}
        onChange={e => {
          const file = e.target.files?.[0];
          if (file) uploadFile(file);
          e.target.value = '';
        }}
      />

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20, alignItems: 'start' }}>
        {/* 좌: 업로드 + 등록 목록 */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          {/* 업로드 카드 */}
          <div style={{ background: '#fff', borderRadius: 12, border: '1px solid var(--gray2)', padding: '20px 22px' }}>
            <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--navy)', marginBottom: 14 }}>양식지 업로드</div>
            <div
              onClick={() => !uploading && fileInputRef.current?.click()}
              style={{
                border: '1.5px dashed var(--gray3)', borderRadius: 12,
                padding: '36px 20px', textAlign: 'center',
                background: 'var(--gray1)',
                cursor: uploading ? 'not-allowed' : 'pointer',
                transition: 'all .15s',
              }}
              onMouseEnter={e => {
                if (uploading) return;
                e.currentTarget.style.borderColor = 'var(--navy)';
                e.currentTarget.style.background = 'var(--blue-pale)';
              }}
              onMouseLeave={e => {
                e.currentTarget.style.borderColor = 'var(--gray3)';
                e.currentTarget.style.background = 'var(--gray1)';
              }}
            >
              <div style={{
                width: 48, height: 48, background: '#fff', borderRadius: 9,
                border: '1px solid var(--gray2)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                margin: '0 auto 12px',
              }}>
                <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="var(--navy)" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                  <rect x="5" y="3" width="14" height="18" rx="2" />
                  <path d="M9 7h6M9 11h6M9 15h4" />
                </svg>
              </div>
              <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--navy)', marginBottom: 4 }}>
                {uploading ? '업로드 중...' : '양식지 파일 업로드'}
              </div>
              <div style={{ fontSize: 11, color: 'var(--gray4)', marginBottom: 14 }}>
                HWP, DOCX, XLSX, PDF · 최대 20MB
              </div>
              <button
                onClick={e => { e.stopPropagation(); fileInputRef.current?.click(); }}
                disabled={uploading}
                style={{
                  background: 'var(--navy)', color: '#fff', border: 'none',
                  borderRadius: 6, padding: '5px 13px', fontSize: 11, fontWeight: 600,
                  cursor: uploading ? 'not-allowed' : 'pointer', fontFamily: 'inherit',
                }}
              >양식지 선택</button>
            </div>
            {error && (
              <div style={{
                marginTop: 12,
                fontSize: 12, color: 'var(--red)',
                background: 'var(--red-bg)', border: '1px solid #F5C6C6',
                borderRadius: 6, padding: '8px 12px',
              }}>{error}</div>
            )}
          </div>

          {/* 등록된 양식지 */}
          <div style={{ background: '#fff', borderRadius: 12, border: '1px solid var(--gray2)', padding: '20px 22px' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
              <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--navy)' }}>등록된 양식지</div>
              <button
                onClick={() => fileInputRef.current?.click()}
                disabled={uploading}
                style={{
                  background: 'var(--navy)', color: '#fff', border: 'none',
                  borderRadius: 6, padding: '5px 13px', fontSize: 11, fontWeight: 600,
                  cursor: uploading ? 'not-allowed' : 'pointer', fontFamily: 'inherit',
                }}
              >+ 추가</button>
            </div>

            {forms.length === 0 ? (
              <div style={{ fontSize: 12, color: 'var(--gray4)', padding: '16px 0', textAlign: 'center' }}>
                아직 등록된 양식지가 없습니다.
              </div>
            ) : (
              forms.map((f, i) => {
                const fileName = f.fileName ?? f.formName;
                const ext = getExt(fileName);
                const c = EXT_COLORS[ext] ?? { bg: 'var(--gray1)', color: 'var(--gray4)' };
                const active = f.active !== false;
                return (
                  <div key={f.formId}
                    style={{
                      display: 'flex', alignItems: 'center', gap: 12,
                      padding: '12px 0',
                      borderBottom: i === forms.length - 1 ? 'none' : '1px solid var(--gray1)',
                      cursor: 'pointer', transition: 'background .12s',
                    }}
                  >
                    <div style={{
                      width: 30, height: 34, background: c.bg, borderRadius: 4,
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      fontSize: 9, fontWeight: 700, color: c.color, flexShrink: 0,
                    }}>{ext || '파일'}</div>
                    <div style={{ flex: 1, marginLeft: 4, minWidth: 0 }}>
                      <div style={{
                        fontSize: 12, fontWeight: 600, color: 'var(--navy)',
                        overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                      }}>{f.formName}</div>
                      <div style={{ fontSize: 10, color: 'var(--gray4)' }}>등록일 {formatDate(f.createdAt)}</div>
                    </div>
                    <span style={{
                      display: 'inline-flex', alignItems: 'center',
                      fontSize: 10, fontWeight: 700, padding: '2px 8px', borderRadius: 100,
                      background: active ? 'var(--green-bg)' : 'var(--gray2)',
                      color: active ? 'var(--green)' : 'var(--gray4)',
                    }}>{active ? '활성' : '비활성'}</span>
                    <button
                      onClick={e => { e.stopPropagation(); setEditTarget(f); setEditName(f.formName); }}
                      style={{
                        background: 'var(--gray2)', color: 'var(--gray5)',
                        border: 'none', borderRadius: 6,
                        padding: '5px 13px', fontSize: 11, fontWeight: 600,
                        cursor: 'pointer', fontFamily: 'inherit',
                      }}>수정</button>
                    <button
                      onClick={e => { e.stopPropagation(); handleDelete(f.formId); }}
                      style={{
                        background: 'var(--red-bg)', color: 'var(--red)',
                        border: 'none', borderRadius: 6,
                        padding: '5px 13px', fontSize: 11, fontWeight: 600,
                        cursor: 'pointer', fontFamily: 'inherit',
                      }}>삭제</button>
                  </div>
                );
              })
            )}
          </div>
        </div>

        {/* 우: 최근 생성 보고서 */}
        <div style={{ background: '#fff', borderRadius: 12, border: '1px solid var(--gray2)', padding: '20px 22px' }}>
          <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--navy)', marginBottom: 14 }}>최근 생성 보고서</div>
          {reports.length === 0 ? (
            <div style={{ fontSize: 12, color: 'var(--gray4)', padding: '16px 0', textAlign: 'center' }}>
              완료된 보고서가 없습니다.
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {reports.map(r => {
                const meta = [r.fileType, r.itemCount != null ? `${r.itemCount}건` : null].filter(Boolean).join(' · ');
                return (
                  <div key={r.evidenceId} style={{
                    display: 'flex', alignItems: 'center', gap: 10,
                    padding: 12, background: 'var(--gray1)', borderRadius: 9,
                  }}>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{
                        fontSize: 12, fontWeight: 600, color: 'var(--navy)',
                        overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                      }}>{r.title}</div>
                      <div style={{ fontSize: 10, color: 'var(--gray4)', marginTop: 2 }}>
                        생성일 {formatDate(r.createdAt)}{meta ? ` · ${meta}` : ''}
                      </div>
                    </div>
                    <button
                      onClick={() => handleReportDownload(r.evidenceId)}
                      disabled={downloading === r.evidenceId}
                      style={{
                        background: 'var(--navy)', color: '#fff', border: 'none',
                        borderRadius: 6, padding: '5px 13px', fontSize: 11, fontWeight: 600,
                        cursor: downloading === r.evidenceId ? 'not-allowed' : 'pointer',
                        fontFamily: 'inherit', flexShrink: 0,
                        opacity: downloading === r.evidenceId ? 0.7 : 1,
                      }}
                    >{downloading === r.evidenceId ? '생성 중...' : '다운로드'}</button>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* 수정 모달 */}
      {editTarget && (
        <div style={{
          position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)',
          display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 500,
        }} onClick={() => setEditTarget(null)}>
          <div style={{
            background: '#fff', borderRadius: 12, padding: 24, width: 360,
            boxShadow: '0 12px 32px rgba(28,43,74,.18)',
          }} onClick={e => e.stopPropagation()}>
            <div style={{ fontSize: 15, fontWeight: 700, color: 'var(--navy)', marginBottom: 16 }}>양식지 이름 수정</div>
            <input
              style={{
                width: '100%', border: '1px solid var(--gray2)', borderRadius: 6,
                padding: '9px 12px', fontSize: 13, fontFamily: 'inherit',
                color: 'var(--navy)', outline: 'none', marginBottom: 16,
              }}
              value={editName}
              onChange={e => setEditName(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && handleEditSave()}
              autoFocus
            />
            <div style={{ display: 'flex', gap: 8 }}>
              <button
                onClick={() => setEditTarget(null)}
                style={{
                  flex: 1, background: 'var(--gray2)', color: 'var(--gray5)',
                  border: 'none', borderRadius: 6, padding: '9px 0',
                  fontSize: 13, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit',
                }}>취소</button>
              <button
                onClick={handleEditSave}
                disabled={editSaving || !editName.trim()}
                style={{
                  flex: 1, background: 'var(--navy)', color: '#fff',
                  border: 'none', borderRadius: 6, padding: '9px 0',
                  fontSize: 13, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit',
                  opacity: editSaving || !editName.trim() ? 0.5 : 1,
                }}>{editSaving ? '저장 중...' : '저장'}</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
