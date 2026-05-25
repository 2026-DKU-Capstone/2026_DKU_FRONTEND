'use client';

import React, { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { apiFetch } from '@/lib/api';
import { getGroupId } from '@/lib/group';
import { getUserInfo } from '@/lib/auth';
import { downloadDocument } from '@/lib/downloadDocument';

interface UploadedPhoto {
  photoId: string;
  filePath: string;
  fileName: string;
  label: string;
}

export default function PDFScreen() {
  const router = useRouter();
  const [downloading, setDownloading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [submittedRequestId, setSubmittedRequestId] = useState<number | null>(null);
  const [error, setError] = useState('');
  const [submitError, setSubmitError] = useState('');
  const [formName, setFormName] = useState('지출결의서');
  const [totalAmount, setTotalAmount] = useState(0);
  const [docNumber, setDocNumber] = useState<string>('—');

  const [photos, setPhotos] = useState<UploadedPhoto[]>([]);
  const [photoLabel, setPhotoLabel] = useState('사진');
  const [photoUploading, setPhotoUploading] = useState(false);
  const [photoError, setPhotoError] = useState('');
  const photoInputRef = useRef<HTMLInputElement>(null);

  // #14 다운로드 완료 피드백
  const [downloaded, setDownloaded] = useState(false);
  const [toast, setToast] = useState('');

  // #3 연속 작성: 업로드한 증빙 큐에서 현재 위치 (여러 건 업로드 시에만 사용)
  const [queuePos, setQueuePos] = useState<{ index: number; total: number } | null>(null);

  useEffect(() => {
    const name = sessionStorage.getItem('formName');
    if (name) setFormName(name);

    const filledRaw = sessionStorage.getItem('filledFields');
    const userInputRaw = sessionStorage.getItem('userInputFields');
    const filled: Record<string, string> = filledRaw ? JSON.parse(filledRaw) : {};
    const userInput: Record<string, string> = userInputRaw ? JSON.parse(userInputRaw) : {};
    const merged = { ...filled, ...userInput };

    const total = Object.entries(merged).reduce((acc, [k, v]) => {
      const n = parseInt(String(v).replace(/[^\d-]/g, ''), 10);
      if (!isNaN(n) && /금액|비$|료$|값$/.test(k)) return acc + n;
      return acc;
    }, 0);
    setTotalAmount(total);

    const evidenceId = sessionStorage.getItem('evidenceId');
    if (evidenceId) setDocNumber(`#${new Date().getFullYear()}-${evidenceId.padStart(4, '0')}`);

    // #3 연속 작성: 여러 건 업로드한 경우 큐 내 현재 위치 파악
    try {
      const q = JSON.parse(sessionStorage.getItem('evidenceQueue') ?? '[]');
      const idx = parseInt(sessionStorage.getItem('queueIndex') ?? '0', 10);
      if (Array.isArray(q) && q.length > 1) setQueuePos({ index: idx, total: q.length });
    } catch { /* 무시 */ }
  }, []);

  async function handleDownload() {
    const evidenceId = sessionStorage.getItem('evidenceId');
    const formId = sessionStorage.getItem('formId');
    const filledFieldsRaw = sessionStorage.getItem('filledFields');

    if (!evidenceId || !formId) {
      setError('증빙 정보가 없습니다. 처음부터 다시 진행해 주세요.');
      return;
    }

    setDownloading(true); setError('');
    try {
      const filledFields: Record<string, string> = filledFieldsRaw ? JSON.parse(filledFieldsRaw) : {};
      const userInputFieldsRaw = sessionStorage.getItem('userInputFields');
      const userInputFields: Record<string, string> = userInputFieldsRaw ? JSON.parse(userInputFieldsRaw) : {};
      // 증빙서류 자체를 사진란에 자동 부착.
      // - 백엔드 resolveImageBytes는 source="evidence"를 evidence 파일 바이트로 로드.
      // - evidence가 이미지가 아니면(XLS/PDF 등) 백엔드가 자동으로 무시.
      // - 필드명 "영수증"으로 보내면 양식의 "영수증 부착(...)" 셀에 우선 매칭(백엔드 Pass 2a).
      const imageFields: Record<string, string> = { '영수증': 'evidence' };
      // 사용자가 PhotoScreen에서 올린 사진(예: 학생증)도 함께. 같은 키면 사용자 입력이 덮어씀.
      photos.forEach(p => { imageFields[p.label] = p.filePath; });
      // doc-review에서 올린 학생증을 양식의 '학생증 부착' 란에 부착 (영수증 부착과 동일 방식)
      try {
        const scRaw = sessionStorage.getItem('studentCardPhoto');
        if (scRaw) {
          const sc: { label?: string; filePath?: string } = JSON.parse(scRaw);
          if (sc.filePath) imageFields[sc.label || '학생증'] = sc.filePath;
        }
      } catch { /* 무시 */ }

      const err = await downloadDocument({ evidenceId, formId, filledFields, userInputFields, imageFields, formName });
      if (err) {
        setError(err);
      } else {
        // #14 다운로드 완료 피드백: 토스트 + 버튼 일시 전환
        setDownloaded(true);
        setToast('문서가 다운로드되었습니다.');
        setTimeout(() => { setDownloaded(false); setToast(''); }, 2500);
      }
    } catch { setError('서버에 연결할 수 없습니다.'); }
    finally { setDownloading(false); }
  }

  async function handleSubmit() {
    const evidenceId = sessionStorage.getItem('evidenceId');
    const formId = sessionStorage.getItem('formId');
    const filledFieldsRaw = sessionStorage.getItem('filledFields');
    const userInputFieldsRaw = sessionStorage.getItem('userInputFields');
    const groupId = getGroupId();

    if (!evidenceId || !formId || !groupId) {
      setSubmitError('증빙 정보 또는 그룹 정보가 없습니다.');
      return;
    }

    setSubmitting(true); setSubmitError('');
    try {
      const filledFields: Record<string, string> = filledFieldsRaw ? JSON.parse(filledFieldsRaw) : {};
      const userInputFields: Record<string, string> = userInputFieldsRaw ? JSON.parse(userInputFieldsRaw) : {};
      const mergedFields = { ...filledFields, ...userInputFields };

      const res = await apiFetch('/api/approvals', {
        method: 'POST',
        body: JSON.stringify({
          groupId,
          evidenceId: Number(evidenceId),
          formId: Number(formId),
          filledFields: mergedFields,
        }),
      });

      if (res.ok) {
        const data = await res.json().catch(() => null);
        ['evidenceId', 'availableForms', 'filledFields', 'formId', 'lastStep'].forEach(
          key => sessionStorage.removeItem(key)
        );
        setSubmitted(true);
        if (data?.requestId) setSubmittedRequestId(data.requestId);
      }
      else {
        const body = await res.json().catch(() => null);
        setSubmitError(body?.error ?? '결재 제출에 실패했습니다.');
      }
    } catch { setSubmitError('서버에 연결할 수 없습니다.'); }
    finally { setSubmitting(false); }
  }

  async function uploadPhoto(file: File) {
    setPhotoUploading(true); setPhotoError('');
    try {
      const fd = new FormData();
      fd.append('file', file);
      fd.append('label', photoLabel.trim() || '사진');
      const res = await apiFetch('/api/photos/upload', { method: 'POST', body: fd });
      if (res.ok) {
        const data: UploadedPhoto = await res.json();
        setPhotos(prev => [...prev, data]);
      } else {
        const body = await res.json().catch(() => null);
        setPhotoError(body?.error ?? '사진 업로드에 실패했습니다.');
      }
    } catch { setPhotoError('서버에 연결할 수 없습니다.'); }
    finally { setPhotoUploading(false); }
  }

  async function deletePhoto(photoId: string) {
    try {
      const res = await apiFetch(`/api/photos/${photoId}`, { method: 'DELETE' });
      if (res.ok || res.status === 204) {
        setPhotos(prev => prev.filter(p => p.photoId !== photoId));
      }
    } catch { /* 무시 */ }
  }

  // #9 추가 증빙서류 작성: 현재 문서 상태를 초기화하고 Step 1로 이동 (같은 사업명·그룹은 유지)
  function startNewDocument() {
    ['evidenceId', 'availableForms', 'formId', 'formName', 'filledFields', 'missingFields',
     'userInputFields', 'selectedFormIds', 'evidenceQueue', 'queueIndex', 'studentCardPhoto']
      .forEach(k => sessionStorage.removeItem(k));
    router.push('/receipt');
  }

  // #3 연속 작성: 업로드한 다음 증빙으로 이어서 진행 (영수증 재선택 없이 양식 추천부터)
  function goToNextInQueue() {
    try {
      const q = JSON.parse(sessionStorage.getItem('evidenceQueue') ?? '[]');
      const idx = parseInt(sessionStorage.getItem('queueIndex') ?? '0', 10);
      const next = idx + 1;
      if (!Array.isArray(q) || next >= q.length) return;
      // 다음 증빙으로 전환 + 현재 문서 작성 상태 초기화 (사업명·그룹·큐는 유지)
      sessionStorage.setItem('queueIndex', String(next));
      sessionStorage.setItem('evidenceId', String(q[next].evidenceId));
      sessionStorage.setItem('availableForms', JSON.stringify(q[next].availableForms));
      ['formId', 'formName', 'filledFields', 'missingFields', 'userInputFields', 'selectedFormIds', 'studentCardPhoto']
        .forEach(k => sessionStorage.removeItem(k));
      router.push('/form-recommend');
    } catch { /* 무시 */ }
  }

  return (
    <div style={{ fontFamily: 'var(--font-ui)', padding: '28px 32px', color: 'var(--navy)' }}>
      {/* 완료 배너 */}
      <div style={{
        display: 'flex', alignItems: 'center', gap: 12,
        padding: '14px 18px',
        background: 'var(--green-bg)', borderRadius: 10,
        border: '1px solid rgba(58,138,92,0.18)', marginBottom: 24,
      }}>
        <div style={{
          width: 28, height: 28, borderRadius: '50%',
          background: 'var(--green)', color: '#fff',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontSize: 14, fontWeight: 700, flexShrink: 0,
        }}>✓</div>
        <div>
          <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--green)' }}>모든 규정 검사 통과</div>
          <div style={{ fontSize: 11, color: 'var(--gray5)' }}>
            최종 문서가 준비되었습니다. 아래에서 저장 방법을 선택하세요.
          </div>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '360px 1fr', gap: 20, alignItems: 'start' }}>
        {/* PDF 다운로드 카드 */}
        <div style={{
          background: '#fff', borderRadius: 14,
          border: '1px solid var(--gray2)', overflow: 'hidden',
        }}>
          <div style={{
            background: 'var(--gray1)', height: 260,
            display: 'flex', flexDirection: 'column',
            alignItems: 'center', justifyContent: 'center',
            borderBottom: '1px solid var(--gray2)', gap: 12,
          }}>
            <div style={{
              fontSize: 11, color: 'var(--gray4)',
              display: 'flex', alignItems: 'center', gap: 6,
            }}>
              <span style={{
                display: 'inline-flex', alignItems: 'center', gap: 3,
                fontSize: 10, fontWeight: 700, padding: '2px 8px', borderRadius: 100,
                background: 'var(--green-bg)', color: 'var(--green)',
              }}>규정 검사 완료</span>
              최종본 준비됨
            </div>
            <div style={{
              background: '#fff', width: 140, borderRadius: 3,
              border: '1px solid var(--gray2)', padding: 11,
              display: 'flex', flexDirection: 'column', gap: 4,
            }}>
              <div style={{
                textAlign: 'center', fontSize: 8, fontWeight: 700,
                color: 'var(--navy)',
                borderBottom: '1.5px solid var(--navy)',
                paddingBottom: 5, marginBottom: 5,
              }}>{formName}</div>
              <div style={{ height: 2.5, background: 'var(--gray2)', borderRadius: 1, width: '80%' }} />
              <div style={{ height: 2.5, background: 'var(--gray2)', borderRadius: 1, width: '60%' }} />
              <div style={{ height: 5 }} />
              <div style={{ height: 2.5, background: 'var(--navy)', borderRadius: 1 }} />
              <div style={{ height: 5 }} />
              <div style={{ height: 2.5, background: 'var(--gray2)', borderRadius: 1, width: '75%' }} />
              <div style={{ height: 14 }} />
              <div style={{ display: 'flex', justifyContent: 'space-around' }}>
                {[0, 1, 2].map(i => (
                  <div key={i} style={{ width: 26, height: 18, borderTop: '1px solid var(--gray3)' }} />
                ))}
              </div>
            </div>
            <div style={{ fontSize: 10, color: 'var(--gray4)' }}>
              {formName.replace(/\s/g, '')}_{docNumber.replace('#', '')}
            </div>
          </div>

          {error && (
            <div style={{
              fontSize: 12, color: 'var(--red)',
              background: 'var(--red-bg)', borderBottom: '1px solid #F5C6C6',
              padding: '8px 16px',
            }}>{error}</div>
          )}

          <div style={{ padding: '16px 18px', display: 'flex', flexDirection: 'column', gap: 8 }}>
            <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--navy)', marginBottom: 4 }}>저장 옵션</div>
            <button
              onClick={handleDownload}
              disabled={downloading}
              style={{
                background: downloaded ? 'var(--green)' : 'var(--navy)', color: '#fff', border: 'none',
                borderRadius: 6, padding: '9px 20px',
                fontSize: 13, fontWeight: 600,
                cursor: downloading ? 'not-allowed' : 'pointer', fontFamily: 'inherit',
                opacity: downloading ? 0.7 : 1,
                transition: 'background .2s',
              }}
            >{downloading ? '생성 중...' : downloaded ? '다운로드 완료 ✓' : '문서 다운로드'}</button>
            <button
              onClick={handleSubmit}
              disabled={submitting || submitted}
              style={{
                background: submitted ? 'var(--green)' : 'transparent',
                color: submitted ? '#fff' : 'var(--navy)',
                border: submitted ? 'none' : '1.5px solid var(--navy)',
                borderRadius: 6, padding: '9px 20px',
                fontSize: 13, fontWeight: 600,
                cursor: (submitting || submitted) ? 'default' : 'pointer',
                fontFamily: 'inherit',
                opacity: submitting ? 0.7 : 1,
              }}
            >{submitted ? '제출 완료' : submitting ? '제출 중...' : '결재 시스템으로 제출'}</button>
            <button style={{
              background: 'var(--gray2)', color: 'var(--gray5)', border: 'none',
              borderRadius: 6, padding: '9px 20px',
              fontSize: 13, fontWeight: 600,
              cursor: 'pointer', fontFamily: 'inherit',
            }}>이메일로 전송</button>
          </div>
        </div>

        {/* 우측 정보 카드들 */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          {/* 사진 첨부 (선택) */}
          <div style={{
            background: '#fff', borderRadius: 12,
            border: '1px solid var(--gray2)', padding: '18px 20px',
          }}>
            <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--navy)', marginBottom: 4 }}>
              사진 첨부 <span style={{ fontWeight: 400, color: 'var(--gray4)', fontSize: 11 }}>(선택)</span>
            </div>
            <div style={{ fontSize: 11, color: 'var(--gray5)', marginBottom: 12 }}>
              학생증·도장·서명 등 양식지에 들어갈 사진. 라벨은 양식의 사진 필드명과 일치해야 합니다.
            </div>
            <input
              ref={photoInputRef}
              type="file"
              accept="image/jpeg,image/jpg,image/png,image/webp,image/gif"
              style={{ display: 'none' }}
              onChange={e => {
                const file = e.target.files?.[0];
                if (file) uploadPhoto(file);
                e.target.value = '';
              }}
            />
            <div style={{ display: 'flex', gap: 8, marginBottom: 10 }}>
              <input
                value={photoLabel}
                onChange={e => setPhotoLabel(e.target.value)}
                placeholder="라벨 (예: 학생증, 도장)"
                style={{
                  flex: 1, border: '1px solid var(--gray2)', borderRadius: 6,
                  padding: '7px 10px', fontSize: 12, fontFamily: 'inherit',
                  color: 'var(--navy)', outline: 'none', height: 32,
                }}
              />
              <button
                onClick={() => photoInputRef.current?.click()}
                disabled={photoUploading}
                style={{
                  background: 'var(--navy)', color: '#fff', border: 'none',
                  borderRadius: 6, padding: '0 14px', fontSize: 11, fontWeight: 600,
                  cursor: photoUploading ? 'not-allowed' : 'pointer', fontFamily: 'inherit',
                  opacity: photoUploading ? 0.7 : 1,
                }}
              >{photoUploading ? '업로드 중' : '+ 사진 선택'}</button>
            </div>
            {photoError && (
              <div style={{
                fontSize: 11, color: 'var(--red)',
                background: 'var(--red-bg)', border: '1px solid #F5C6C6',
                borderRadius: 6, padding: '6px 10px', marginBottom: 8,
              }}>{photoError}</div>
            )}
            {photos.length > 0 && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                {photos.map(p => (
                  <div key={p.photoId} style={{
                    display: 'flex', alignItems: 'center', gap: 10,
                    background: 'var(--gray1)', borderRadius: 6,
                    padding: '8px 10px',
                  }}>
                    <div style={{
                      width: 28, height: 32, background: 'var(--blue-pale)',
                      color: 'var(--blue)', borderRadius: 4,
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      fontSize: 9, fontWeight: 700, flexShrink: 0,
                    }}>IMG</div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{
                        fontSize: 12, fontWeight: 600, color: 'var(--navy)',
                        overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                      }}>{p.fileName}</div>
                      <div style={{ fontSize: 10, color: 'var(--gray4)' }}>라벨: {p.label}</div>
                    </div>
                    <button
                      onClick={() => deletePhoto(p.photoId)}
                      style={{
                        background: 'none', border: 'none', color: 'var(--gray3)',
                        cursor: 'pointer', fontSize: 14, fontFamily: 'inherit',
                      }}
                    >✕</button>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div style={{
            background: '#fff', borderRadius: 12,
            border: '1px solid var(--gray2)', padding: '18px 20px',
          }}>
            <div style={{
              fontSize: 13, fontWeight: 700, color: 'var(--navy)', marginBottom: 12,
            }}>
              최종 검토 요약
              <span style={{
                display: 'inline-flex', alignItems: 'center', gap: 3,
                fontSize: 10, fontWeight: 700, padding: '2px 8px', borderRadius: 100,
                background: 'var(--green-bg)', color: 'var(--green)',
                marginLeft: 6,
              }}>통과</span>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {[
                '한도 규정 준수',
                '증빙 자료 첨부 완료',
                '필수 항목 입력 완료',
                '결재 라인 설정 완료',
              ].map(t => (
                <div key={t} style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12 }}>
                  <span style={{ color: 'var(--green)', fontWeight: 700 }}>✓</span>
                  <span style={{ color: 'var(--gray5)' }}>{t}</span>
                </div>
              ))}
            </div>
          </div>

          <div style={{
            background: '#fff', borderRadius: 12,
            border: '1px solid var(--gray2)', padding: '18px 20px',
          }}>
            <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--navy)', marginBottom: 12 }}>문서 정보</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {[
                { label: '문서 번호', value: docNumber, mono: true },
                { label: '생성 일시', value: new Date().toLocaleString('ko-KR') },
                { label: '신청자',    value: getUserInfo()?.name ?? '' },
                { label: '총 금액',   value: `${totalAmount.toLocaleString()}원`, mono: true, bold: true },
              ].map(r => (
                <div key={r.label} style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12 }}>
                  <span style={{ color: 'var(--gray4)' }}>{r.label}</span>
                  <span style={{
                    color: 'var(--navy)',
                    fontFamily: r.mono ? 'var(--font-mono)' : 'inherit',
                    fontWeight: r.bold ? 700 : 600,
                  }}>{r.value}</span>
                </div>
              ))}
            </div>
          </div>

          {submitError && (
            <div style={{
              fontSize: 12, color: 'var(--red)',
              background: 'var(--red-bg)', border: '1px solid #F5C6C6',
              borderRadius: 6, padding: '8px 12px',
            }}>{submitError}</div>
          )}

          {submitted && (
            <div style={{
              background: 'var(--green-bg)', border: '1px solid #B8DAC4',
              borderRadius: 12, padding: '14px 18px',
              display: 'flex', alignItems: 'center', gap: 10,
            }}>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--green)', marginBottom: 3 }}>
                  결재 요청 완료
                </div>
                <div style={{ fontSize: 11, color: 'var(--gray5)' }}>
                  결재 목록에서 진행 상황을 확인할 수 있습니다.
                </div>
              </div>
              <div style={{ display: 'flex', gap: 6 }}>
                {submittedRequestId != null && (
                  <button
                    onClick={() => router.push(`/approvals/${submittedRequestId}`)}
                    style={{
                      background: 'var(--navy)', color: '#fff', border: 'none',
                      borderRadius: 6, padding: '7px 14px', fontSize: 12, fontWeight: 600,
                      cursor: 'pointer', fontFamily: 'inherit',
                    }}
                  >결재 상세 →</button>
                )}
                <button
                  onClick={() => router.push('/approvals')}
                  style={{
                    background: 'transparent', color: 'var(--navy)',
                    border: '1px solid var(--navy)',
                    borderRadius: 6, padding: '7px 14px', fontSize: 12, fontWeight: 600,
                    cursor: 'pointer', fontFamily: 'inherit',
                  }}
                >결재 목록 보기</button>
              </div>
            </div>
          )}

          <div style={{
            background: 'var(--blue-pale)',
            border: '1px solid #C8D6E8', borderRadius: 12,
            padding: '18px 20px',
          }}>
            {queuePos && queuePos.index + 1 < queuePos.total ? (
              /* #3 업로드한 다음 증빙이 남아 있으면 이어서 작성 */
              <>
                <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--navy)', marginBottom: 5 }}>
                  다음 증빙서류 작성
                </div>
                <div style={{ fontSize: 11, color: 'var(--gray5)', marginBottom: 10 }}>
                  업로드한 증빙 {queuePos.total}건 중 {queuePos.index + 1}번째까지 작성했습니다.
                  영수증 재선택 없이 다음 증빙서류로 이어서 작성하세요.
                </div>
                <button
                  onClick={goToNextInQueue}
                  style={{
                    background: 'var(--navy)', color: '#fff', border: 'none',
                    borderRadius: 6, padding: '5px 13px', fontSize: 11, fontWeight: 600,
                    cursor: 'pointer', fontFamily: 'inherit',
                  }}
                >다음 증빙서류 작성 ({queuePos.index + 2}/{queuePos.total}) →</button>
                <button
                  onClick={() => router.push('/expense-board')}
                  style={{
                    marginLeft: 8,
                    background: 'var(--gray2)', color: 'var(--gray5)', border: 'none',
                    borderRadius: 6, padding: '5px 13px', fontSize: 11, fontWeight: 600,
                    cursor: 'pointer', fontFamily: 'inherit',
                  }}
                >목록으로</button>
              </>
            ) : (
              <>
                <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--navy)', marginBottom: 5 }}>새 문서 작성</div>
                <div style={{ fontSize: 11, color: 'var(--gray5)', marginBottom: 10 }}>
                  {queuePos ? '업로드한 증빙을 모두 작성했습니다. ' : ''}같은 사업의 다른 지출결의서를 작성하시겠습니까?
                </div>
                <button
                  onClick={startNewDocument}
                  style={{
                    background: 'var(--navy)', color: '#fff', border: 'none',
                    borderRadius: 6, padding: '5px 13px', fontSize: 11, fontWeight: 600,
                    cursor: 'pointer', fontFamily: 'inherit',
                  }}
                >+ 추가 증빙서류 작성</button>
                <button
                  onClick={() => router.push('/expense-board')}
                  style={{
                    marginLeft: 8,
                    background: 'var(--gray2)', color: 'var(--gray5)', border: 'none',
                    borderRadius: 6, padding: '5px 13px', fontSize: 11, fontWeight: 600,
                    cursor: 'pointer', fontFamily: 'inherit',
                  }}
                >목록으로</button>
              </>
            )}
          </div>
        </div>
      </div>

      {/* #14 다운로드 완료 토스트 */}
      {toast && (
        <div style={{
          position: 'fixed', bottom: 28, left: '50%', transform: 'translateX(-50%)',
          background: 'var(--navy)', color: '#fff',
          padding: '12px 22px', borderRadius: 10, fontSize: 13, fontWeight: 600,
          boxShadow: '0 10px 30px rgba(28,43,74,.25)', zIndex: 1000,
          display: 'flex', alignItems: 'center', gap: 8,
        }}>
          <span style={{ color: 'var(--green)', fontWeight: 700 }}>✓</span>
          {toast}
        </div>
      )}
    </div>
  );
}
