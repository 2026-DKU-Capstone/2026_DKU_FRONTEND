'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Modal } from '@/components/ui';
import { apiFetch } from '@/lib/api';
import { getGroupId } from '@/lib/group';
import { downloadDocument } from '@/lib/downloadDocument';

type EvidenceStatus = 'draft' | 'in_progress' | 'approved' | 'rejected';

interface EvidenceItem {
  evidenceId: number;
  requestId: number | null;
  businessName: string;
  status: EvidenceStatus;
  fileType: string | null;
  updatedAt: string | null;
  createdAt: string | null;
}

interface HistoryStep {
  approverName: string;
  roleName: string;
  action: string;
  comment: string | null;
  actedAt: string | null;
}

interface ApprovalHistory {
  requestId: number;
  evidenceId?: number;
  formId?: number;
  formName?: string;
  status: string;
  filledFields: Record<string, string>;
  steps: HistoryStep[];
  editHistory: unknown[];
}

const LAST_STEP_ROUTES: Record<string, string> = {
  '1': '/receipt',
  '2': '/form-recommend',
  '3': '/doc-review',
  '4': '/compliance',
  '5': '/pdf',
};

function formatDate(s: string | null): string {
  if (!s) return '-';
  return s.slice(0, 10).replace(/-/g, '.');
}

export default function ExpenseBoardScreen() {
  const router = useRouter();
  const [items, setItems] = useState<EvidenceItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [isTopApprover, setIsTopApprover] = useState(false);
  const [newBizOpen, setNewBizOpen] = useState(false);
  const [bizName, setBizName] = useState('');
  const [itemName, setItemName] = useState('');

  // 완료 상세 모달
  const [detailOpen, setDetailOpen] = useState(false);
  const [detailLoading, setDetailLoading] = useState(false);
  const [detailData, setDetailData] = useState<ApprovalHistory | null>(null);
  const [detailError, setDetailError] = useState('');
  const [downloading, setDownloading] = useState(false);
  const [downloadError, setDownloadError] = useState('');

  // 삭제 확인 모달
  const [deleteTarget, setDeleteTarget] = useState<EvidenceItem | null>(null);
  const [deleting, setDeleting] = useState(false);

  useEffect(() => {
    const groupId = getGroupId();
    if (!groupId) { setLoading(false); return; }

    Promise.all([
      apiFetch(`/api/evidence/list?groupId=${groupId}`)
        .then(r => r.ok ? r.json() : [])
        .catch(() => []),
      apiFetch(`/api/groups/${groupId}/is-top-approver`)
        .then(r => r.ok ? r.json() : { isTopApprover: false })
        .catch(() => ({ isTopApprover: false })),
    ]).then(([evidenceList, rankInfo]) => {
      setItems(evidenceList);
      setIsTopApprover(rankInfo.isTopApprover ?? false);
    }).finally(() => setLoading(false));
  }, []);

  const visible = items.filter(i => i.status === 'draft' || i.status === 'approved');

  function handleDraftClick(item: EvidenceItem) {
    const storedEvidenceId = localStorage.getItem('evidenceId');
    const lastStep = localStorage.getItem('lastStep');
    if (storedEvidenceId === String(item.evidenceId) && lastStep && LAST_STEP_ROUTES[lastStep]) {
      router.push(LAST_STEP_ROUTES[lastStep]);
    } else {
      // localStorage 데이터 없거나 다른 증빙 → 처음부터
      localStorage.setItem('evidenceId', String(item.evidenceId));
      if (item.businessName) localStorage.setItem('currentBusinessName', item.businessName);
      router.push('/receipt');
    }
  }

  async function handleApprovedClick(item: EvidenceItem) {
    if (!item.requestId) return;
    setDetailOpen(true);
    setDetailLoading(true);
    setDetailData(null);
    setDetailError('');
    setDownloadError('');
    try {
      const res = await apiFetch(`/api/approvals/${item.requestId}/history`);
      if (res.ok) setDetailData(await res.json());
      else setDetailError('상세 정보를 불러오지 못했습니다.');
    } catch { setDetailError('서버에 연결할 수 없습니다.'); }
    finally { setDetailLoading(false); }
  }

  async function handleDownload() {
    if (!detailData?.evidenceId || !detailData?.formId) {
      setDownloadError('증빙 정보가 없어 다운로드할 수 없습니다.');
      return;
    }
    setDownloading(true); setDownloadError('');
    try {
      const err = await downloadDocument({
        evidenceId: detailData.evidenceId,
        formId: detailData.formId,
        filledFields: detailData.filledFields,
        formName: detailData.formName ?? '문서',
      });
      if (err) setDownloadError(err);
    } catch { setDownloadError('서버에 연결할 수 없습니다.'); }
    finally { setDownloading(false); }
  }

  async function handleDelete() {
    if (!deleteTarget?.requestId) return;
    setDeleting(true);
    try {
      const res = await apiFetch(`/api/approvals/${deleteTarget.requestId}`, { method: 'DELETE' });
      if (res.ok || res.status === 204) {
        setItems(prev => prev.filter(i => i.evidenceId !== deleteTarget.evidenceId));
        setDeleteTarget(null);
      } else {
        const b = await res.json().catch(() => null);
        alert(b?.error ?? '삭제에 실패했습니다.');
      }
    } catch { alert('서버에 연결할 수 없습니다.'); }
    finally { setDeleting(false); }
  }

  function startBiz() {
    if (!bizName.trim()) return;
    localStorage.setItem('currentBusinessName', bizName.trim());
    if (itemName.trim()) {
      localStorage.setItem('currentItemName', itemName.trim());
    } else {
      localStorage.removeItem('currentItemName');
    }
    setNewBizOpen(false);
    setBizName('');
    setItemName('');
    router.push('/receipt');
  }

  const fi: React.CSSProperties = {
    width: '100%', border: '1px solid var(--gray2)', borderRadius: 6,
    color: 'var(--navy)', fontSize: 13, fontFamily: 'inherit',
    padding: '9px 12px', height: 40, background: '#fff', outline: 'none',
  };
  const fl: React.CSSProperties = {
    fontSize: 11, fontWeight: 700, color: 'var(--gray5)', marginBottom: 5, display: 'block',
  };

  return (
    <div style={{ fontFamily: 'var(--font-ui)', padding: '28px 32px', color: 'var(--navy)' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
        <div>
          <div style={{ fontSize: 20, fontWeight: 700, color: 'var(--navy)', marginBottom: 4 }}>지출결의</div>
          <div style={{ fontSize: 13, color: 'var(--gray4)' }}>작성 중이거나 완료된 지출결의를 관리합니다</div>
        </div>
        <button
          onClick={() => setNewBizOpen(true)}
          style={{
            background: 'var(--navy)', color: '#fff', border: 'none',
            borderRadius: 6, padding: '9px 20px',
            fontSize: 13, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit',
          }}
        >+ 새 지출결의</button>
      </div>

      <div style={{ background: '#fff', borderRadius: 12, border: '1px solid var(--gray2)', overflow: 'hidden' }}>
        <div style={{
          display: 'grid',
          gridTemplateColumns: isTopApprover ? '60px 1fr 120px 100px 50px' : '60px 1fr 120px 100px',
          alignItems: 'center', gap: 12,
          padding: '14px 20px',
          borderBottom: '1px solid var(--gray1)',
          background: 'var(--gray1)',
          fontSize: 10, fontWeight: 700, color: 'var(--gray4)',
          letterSpacing: '0.3px', textTransform: 'uppercase',
        }}>
          <div>번호</div>
          <div>사업명</div>
          <div>상태</div>
          <div>최근 수정</div>
          {isTopApprover && <div></div>}
        </div>

        {loading ? (
          <div style={{ padding: '32px 20px', textAlign: 'center', fontSize: 13, color: 'var(--gray4)' }}>
            불러오는 중...
          </div>
        ) : visible.length === 0 ? (
          <div style={{ padding: '32px 20px', textAlign: 'center', fontSize: 13, color: 'var(--gray4)' }}>
            등록된 지출결의가 없습니다. 새 지출결의를 시작해 보세요.
          </div>
        ) : visible.map((item, i) => {
          const isDraft = item.status === 'draft';
          const badgeCfg = isDraft
            ? { label: '작성중', bg: 'var(--amber-bg)', color: 'var(--amber)' }
            : { label: '완료', bg: 'var(--green-bg)', color: 'var(--green)' };
          return (
            <div
              key={item.evidenceId}
              onClick={() => isDraft ? handleDraftClick(item) : handleApprovedClick(item)}
              style={{
                display: 'grid',
                gridTemplateColumns: isTopApprover ? '60px 1fr 120px 100px 50px' : '60px 1fr 120px 100px',
                alignItems: 'center', gap: 12,
                padding: '14px 20px',
                borderBottom: i === visible.length - 1 ? 'none' : '1px solid var(--gray1)',
                cursor: 'pointer', transition: 'background .12s',
              }}
              onMouseEnter={e => (e.currentTarget.style.background = 'var(--blue-pale)')}
              onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
            >
              <div style={{ fontSize: 11, color: 'var(--gray4)', fontFamily: 'var(--font-mono)' }}>
                {String(i + 1).padStart(3, '0')}
              </div>
              <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--navy)' }}>
                {item.businessName || '(사업명 없음)'}
              </div>
              <div>
                <span style={{
                  display: 'inline-flex', alignItems: 'center',
                  background: badgeCfg.bg, color: badgeCfg.color,
                  fontSize: 10, fontWeight: 700, padding: '2px 8px', borderRadius: 100,
                }}>{badgeCfg.label}</span>
              </div>
              <div style={{ fontSize: 11, color: 'var(--gray4)' }}>
                {formatDate(item.updatedAt ?? item.createdAt)}
              </div>
              {isTopApprover && (
                <div onClick={e => e.stopPropagation()}>
                  {item.requestId && (
                    <button
                      onClick={() => setDeleteTarget(item)}
                      style={{
                        background: 'none', border: '1px solid var(--red)',
                        color: 'var(--red)', borderRadius: 4,
                        padding: '2px 8px', fontSize: 10, fontWeight: 600,
                        cursor: 'pointer', fontFamily: 'inherit',
                      }}
                    >삭제</button>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* 새 지출결의 모달 */}
      <Modal open={newBizOpen} onClose={() => { setNewBizOpen(false); setBizName(''); setItemName(''); }} width={400}>
        <div style={{ fontSize: 15, fontWeight: 700, color: 'var(--navy)', marginBottom: 4 }}>새 지출결의</div>
        <div style={{ fontSize: 12, color: 'var(--gray4)', marginBottom: 18 }}>사업명과 지출 항목을 입력해 주세요</div>
        <div style={{ marginBottom: 14 }}>
          <label style={fl}>사업명 <span style={{ color: 'var(--red)' }}>*</span></label>
          <input
            style={fi} placeholder="예: 2025년 MT"
            value={bizName} onChange={e => setBizName(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && itemName.trim() === '' && startBiz()}
          />
        </div>
        <div style={{ marginBottom: 20 }}>
          <label style={fl}>지출 항목 <span style={{ color: 'var(--gray4)', fontWeight: 400 }}>(선택)</span></label>
          <input
            style={fi} placeholder="예: 버스 대여비"
            value={itemName} onChange={e => setItemName(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && startBiz()}
          />
          <div style={{ fontSize: 11, color: 'var(--gray4)', marginTop: 5, lineHeight: 1.5 }}>
            입력 시 AI가 내용·특이사항을 더 정확하게 생성합니다
          </div>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <button onClick={() => { setNewBizOpen(false); setBizName(''); setItemName(''); }} style={{ flex: 1, background: 'var(--gray2)', color: 'var(--gray5)', border: 'none', borderRadius: 6, padding: '9px 20px', fontSize: 13, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit' }}>취소</button>
          <button onClick={startBiz} disabled={!bizName.trim()} style={{ flex: 1, background: 'var(--navy)', color: '#fff', border: 'none', borderRadius: 6, padding: '9px 20px', fontSize: 13, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit', opacity: !bizName.trim() ? 0.5 : 1 }}>시작</button>
        </div>
      </Modal>

      {/* 완료 상세 모달 */}
      <Modal open={detailOpen} onClose={() => { setDetailOpen(false); setDetailData(null); }} width={560}>
        {detailLoading ? (
          <div style={{ padding: 20, textAlign: 'center', fontSize: 13, color: 'var(--gray4)' }}>불러오는 중...</div>
        ) : detailError ? (
          <div style={{ padding: 20, fontSize: 13, color: 'var(--red)' }}>{detailError}</div>
        ) : detailData ? (
          <>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
              <div style={{ fontSize: 16, fontWeight: 800, color: 'var(--navy)' }}>
                {detailData.formName ?? '완료된 결재'}
              </div>
              <button
                onClick={handleDownload}
                disabled={downloading}
                style={{
                  background: 'var(--navy)', color: '#fff', border: 'none',
                  borderRadius: 6, padding: '6px 14px', fontSize: 12, fontWeight: 600,
                  cursor: downloading ? 'not-allowed' : 'pointer', fontFamily: 'inherit',
                  opacity: downloading ? 0.7 : 1,
                }}
              >{downloading ? '생성 중...' : '문서 다운로드'}</button>
            </div>

            {downloadError && (
              <div style={{ fontSize: 12, color: 'var(--red)', background: 'var(--red-bg)', border: '1px solid #F5C6C6', borderRadius: 6, padding: '6px 10px', marginBottom: 12 }}>
                {downloadError}
              </div>
            )}

            {/* 필드 테이블 */}
            <div style={{ border: '1px solid var(--gray2)', borderRadius: 8, overflow: 'hidden', marginBottom: 16 }}>
              <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--navy)', padding: '10px 14px', background: 'var(--gray1)', borderBottom: '1px solid var(--gray2)' }}>결재 내용</div>
              <div style={{ maxHeight: 200, overflowY: 'auto' }}>
                {Object.entries(detailData.filledFields).map(([k, v]) => (
                  <div key={k} style={{ display: 'flex', borderBottom: '1px solid var(--gray1)' }}>
                    <div style={{ width: 110, padding: '8px 12px', fontSize: 11, fontWeight: 600, background: 'var(--gray1)', color: 'var(--gray4)', borderRight: '1px solid var(--gray2)', flexShrink: 0 }}>{k}</div>
                    <div style={{ flex: 1, padding: '8px 14px', fontSize: 12, color: 'var(--navy)' }}>{v || '—'}</div>
                  </div>
                ))}
              </div>
            </div>

            {/* 결재 이력 */}
            <div style={{ border: '1px solid var(--gray2)', borderRadius: 8, overflow: 'hidden' }}>
              <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--navy)', padding: '10px 14px', background: 'var(--gray1)', borderBottom: '1px solid var(--gray2)' }}>결재 이력</div>
              {detailData.steps.map((s, i) => (
                <div key={i} style={{ display: 'flex', alignItems: 'flex-start', gap: 10, padding: '10px 14px', borderBottom: i === detailData.steps.length - 1 ? 'none' : '1px solid var(--gray1)' }}>
                  <div style={{ width: 22, height: 22, borderRadius: '50%', flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 11, fontWeight: 700, background: s.action === 'APPROVED' ? 'var(--green-bg)' : s.action === 'REJECTED' ? 'var(--red-bg)' : 'var(--gray2)', color: s.action === 'APPROVED' ? 'var(--green)' : s.action === 'REJECTED' ? 'var(--red)' : 'var(--gray4)' }}>
                    {s.action === 'APPROVED' ? '✓' : s.action === 'REJECTED' ? '✕' : i + 1}
                  </div>
                  <div style={{ flex: 1 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 2 }}>
                      <span style={{ fontSize: 12, fontWeight: 700, color: 'var(--navy)' }}>{s.approverName}</span>
                      <span style={{ fontSize: 10, color: 'var(--gray4)' }}>{s.roleName}</span>
                    </div>
                    {s.comment && <div style={{ fontSize: 11, color: 'var(--gray5)', marginBottom: 2 }}>{s.comment}</div>}
                    {s.actedAt && <div style={{ fontSize: 10, color: 'var(--gray4)', fontFamily: 'var(--font-mono)' }}>{s.actedAt.replace('T', ' ').slice(0, 16)}</div>}
                  </div>
                </div>
              ))}
            </div>
          </>
        ) : null}
      </Modal>

      {/* 삭제 확인 모달 */}
      <Modal open={!!deleteTarget} onClose={() => setDeleteTarget(null)} width={400}>
        <div style={{ fontSize: 15, fontWeight: 700, color: 'var(--navy)', marginBottom: 8 }}>결재 삭제</div>
        <div style={{ fontSize: 13, color: 'var(--gray5)', marginBottom: 20 }}>
          <strong style={{ color: 'var(--navy)' }}>{deleteTarget?.businessName}</strong>의 결재 요청을 삭제합니다.<br />
          이 작업은 되돌릴 수 없습니다.
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <button onClick={() => setDeleteTarget(null)} style={{ flex: 1, background: 'var(--gray2)', color: 'var(--gray5)', border: 'none', borderRadius: 6, padding: '9px 20px', fontSize: 13, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit' }}>취소</button>
          <button onClick={handleDelete} disabled={deleting} style={{ flex: 1, background: 'var(--red)', color: '#fff', border: 'none', borderRadius: 6, padding: '9px 20px', fontSize: 13, fontWeight: 600, cursor: deleting ? 'not-allowed' : 'pointer', fontFamily: 'inherit', opacity: deleting ? 0.7 : 1 }}>{deleting ? '삭제 중...' : '삭제'}</button>
        </div>
      </Modal>
    </div>
  );
}
