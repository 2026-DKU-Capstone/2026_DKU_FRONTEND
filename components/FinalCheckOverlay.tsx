'use client';

import React, { useEffect, useRef, useState } from 'react';
import { apiFetch } from '@/lib/api';
import { getGroupId } from '@/lib/group';

interface PayerInfo {
  name: string;
  affiliation: string;
  studentId: string;
  phone: string;
}

type PayerKey = keyof PayerInfo;

interface Props {
  open: boolean;
  onClose: () => void;
  onProceed: () => void;
}

const LOADING_STEPS = [
  '양식 필수 항목 확인',
  '수령인 정보 확인',
  '증빙 자료 검증',
  '최종 문서 준비',
];

const PAYER_LABEL: Record<PayerKey, string> = {
  studentId:   '학번 / 학생증',
  name:        '이름',
  affiliation: '소속',
  phone:       '전화번호',
};

const PAYER_PLACEHOLDER: Record<PayerKey, string> = {
  studentId:   '예: 32210000',
  name:        '홍길동',
  affiliation: '예: 컴퓨터공학과',
  phone:       '010-1234-5678',
};

type Stage = 'loading' | 'need-input' | 'saving';

export default function FinalCheckOverlay({ open, onClose, onProceed }: Props) {
  const [stage, setStage] = useState<Stage>('loading');
  const [stepIndex, setStepIndex] = useState(0);
  const [error, setError] = useState('');

  const [payer, setPayer] = useState<PayerInfo>({ name: '', affiliation: '', studentId: '', phone: '' });
  const [payerMissing, setPayerMissing] = useState<PayerKey[]>([]);

  const [formMissing, setFormMissing] = useState<string[]>([]);
  const [formValues, setFormValues] = useState<Record<string, string>>({});

  // 학생증 업로드
  const [cardAnalyzing, setCardAnalyzing] = useState(false);
  const [cardError, setCardError] = useState('');
  const [cardExtracted, setCardExtracted] = useState<Set<PayerKey>>(new Set());
  const [cardPreview, setCardPreview] = useState<string | null>(null);
  const [cardFileName, setCardFileName] = useState('');
  const cardInputRef = useRef<HTMLInputElement>(null);

  // 부모가 인라인 콜백을 넘겨도 effect가 재실행되지 않도록 ref로 고정
  const onProceedRef = useRef(onProceed);
  useEffect(() => { onProceedRef.current = onProceed; }, [onProceed]);

  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    setStage('loading');
    setStepIndex(0);
    setError('');
    setCardAnalyzing(false);
    setCardError('');
    setCardExtracted(new Set());
    setCardPreview(null);
    setCardFileName('');

    const stepTimer = setInterval(() => {
      setStepIndex(i => Math.min(i + 1, LOADING_STEPS.length - 1));
    }, 360);

    (async () => {
      const minDelay = new Promise(r => setTimeout(r, 1500));

      // 1. 수령인(지출인) 정보 조회
      let currentPayer: PayerInfo = { name: '', affiliation: '', studentId: '', phone: '' };
      try {
        const groupId = getGroupId();
        if (groupId) {
          const res = await apiFetch(`/api/groups/${groupId}`);
          if (res.ok) {
            const data = await res.json();
            if (data?.payerInfo) currentPayer = { ...currentPayer, ...data.payerInfo };
          }
        }
      } catch { /* 조회 실패 시 모두 미입력으로 간주 */ }

      const missingPayer: PayerKey[] = (['studentId', 'name', 'affiliation', 'phone'] as PayerKey[])
        .filter(k => !(currentPayer[k] ?? '').trim());

      // 2. 양식 필수 항목 누락 여부
      const missingRaw = sessionStorage.getItem('missingFields');
      const userInputRaw = sessionStorage.getItem('userInputFields');
      const missing: string[] = missingRaw ? JSON.parse(missingRaw) : [];
      const userInput: Record<string, string> = userInputRaw ? JSON.parse(userInputRaw) : {};
      const stillMissing = missing.filter(k => !(userInput[k] ?? '').trim());

      await minDelay;
      if (cancelled) return;
      clearInterval(stepTimer);
      setStepIndex(LOADING_STEPS.length - 1);

      if (missingPayer.length === 0 && stillMissing.length === 0) {
        // 부족한 부분 없음 → 잠시 후 PDF 단계로
        setTimeout(() => { if (!cancelled) onProceedRef.current(); }, 320);
        return;
      }

      setPayer(currentPayer);
      setPayerMissing(missingPayer);
      setFormMissing(stillMissing);
      const initVals: Record<string, string> = {};
      stillMissing.forEach(k => { initVals[k] = userInput[k] ?? ''; });
      setFormValues(initVals);
      setStage('need-input');
    })();

    return () => {
      cancelled = true;
      clearInterval(stepTimer);
    };
  }, [open]);

  async function uploadStudentCard(file: File) {
    setCardAnalyzing(true);
    setCardError('');
    setCardFileName(file.name);

    const reader = new FileReader();
    reader.onload = () => setCardPreview(reader.result as string);
    reader.readAsDataURL(file);

    try {
      const fd = new FormData();
      fd.append('file', file);
      const res = await apiFetch('/api/student-id/analyze', { method: 'POST', body: fd });
      if (res.ok) {
        const data = await res.json().catch(() => null);
        const updates: Partial<PayerInfo> = {};
        const extracted: PayerKey[] = [];
        if (data?.name) { updates.name = String(data.name); extracted.push('name'); }
        if (data?.studentId) { updates.studentId = String(data.studentId); extracted.push('studentId'); }
        if (data?.affiliation) { updates.affiliation = String(data.affiliation); extracted.push('affiliation'); }
        if (extracted.length > 0) {
          setPayer(p => ({ ...p, ...updates }));
          setCardExtracted(prev => {
            const next = new Set(prev);
            extracted.forEach(k => next.add(k));
            return next;
          });
        } else {
          setCardError('학생증에서 정보를 인식하지 못했습니다. 직접 입력해 주세요.');
        }
      } else {
        const body = await res.json().catch(() => null);
        setCardError(body?.error ?? '학생증 인식에 실패했습니다. 직접 입력해 주세요.');
      }
    } catch {
      setCardError('서버에 연결할 수 없어 학생증 인식을 건너뜁니다.');
    } finally {
      setCardAnalyzing(false);
    }
  }

  async function handleSubmit() {
    for (const k of payerMissing) {
      if (!(payer[k] ?? '').trim()) {
        setError(`${PAYER_LABEL[k]}을(를) 입력해 주세요.`);
        return;
      }
    }
    for (const k of formMissing) {
      if (!(formValues[k] ?? '').trim()) {
        setError(`${k} 항목을 입력해 주세요.`);
        return;
      }
    }

    setStage('saving');
    setError('');

    try {
      if (payerMissing.length > 0) {
        const groupId = getGroupId();
        if (groupId) {
          const res = await apiFetch(`/api/groups/${groupId}/payer-info`, {
            method: 'PUT',
            body: JSON.stringify(payer),
          });
          if (!res.ok) throw new Error('payer save failed');
        }
      }

      if (formMissing.length > 0) {
        const userInputRaw = sessionStorage.getItem('userInputFields');
        const userInput: Record<string, string> = userInputRaw ? JSON.parse(userInputRaw) : {};
        formMissing.forEach(k => { userInput[k] = formValues[k]; });
        sessionStorage.setItem('userInputFields', JSON.stringify(userInput));
      }

      onProceedRef.current();
    } catch {
      setError('저장에 실패했습니다. 잠시 후 다시 시도해 주세요.');
      setStage('need-input');
    }
  }

  if (!open) return null;

  const isLoading = stage === 'loading' || stage === 'saving';

  // 표시할 수령인 필드: 원래 누락된 것 + 학생증으로 추출되어 추가된 것
  const visiblePayerKeys: PayerKey[] = (['studentId', 'name', 'affiliation', 'phone'] as PayerKey[])
    .filter(k => payerMissing.includes(k) || cardExtracted.has(k));

  // 학생증 업로드는 이름·학번 중 하나라도 비어있을 때만 노출
  const showCardUpload = payerMissing.includes('studentId') || payerMissing.includes('name');

  return (
    <div
      role="dialog"
      aria-modal="true"
      style={{
        position: 'fixed', inset: 0, zIndex: 9999,
        background: 'rgba(12,20,40,0.55)',
        backdropFilter: 'blur(3px)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        fontFamily: 'var(--font-ui)', color: 'var(--navy)',
        padding: 20,
      }}
    >
      <div style={{
        width: stage === 'need-input' ? 500 : 400,
        maxWidth: '100%',
        background: '#fff', borderRadius: 16,
        boxShadow: '0 24px 60px rgba(15,22,40,0.30), 0 4px 14px rgba(15,22,40,0.10)',
        padding: stage === 'need-input' ? '30px 32px 26px' : '38px 32px 32px',
        position: 'relative', overflow: 'hidden',
      }}>
        <div style={{
          position: 'absolute', top: 0, left: 0, right: 0, height: 3,
          background: 'linear-gradient(90deg,#1C2B4A 0%, #4A6FA5 50%, #C49C5C 100%)',
        }} />

        {isLoading ? (
          <div style={{ textAlign: 'center' }}>
            <div style={{
              width: 56, height: 56, margin: '6px auto 18px',
              border: '4px solid var(--gray2)',
              borderTopColor: 'var(--navy)',
              borderRadius: '50%',
              animation: 'fco-spin 0.9s linear infinite',
            }} />
            <div style={{ fontSize: 16, fontWeight: 800, letterSpacing: '-0.2px', marginBottom: 6 }}>
              {stage === 'saving' ? '입력 정보 저장 중' : '최종 문서 준비 중'}
            </div>
            <div style={{ fontSize: 12, color: 'var(--gray5)', marginBottom: 22, lineHeight: 1.6 }}>
              {stage === 'saving'
                ? '잠시만 기다려 주세요. PDF 단계로 이동합니다.'
                : '필요한 정보를 자동으로 확인하고 있어요.'}
            </div>

            {stage === 'loading' && (
              <div style={{
                background: 'var(--gray1)', border: '1px solid var(--gray2)',
                borderRadius: 10, padding: '12px 16px',
                display: 'flex', flexDirection: 'column', gap: 8, textAlign: 'left',
              }}>
                {LOADING_STEPS.map((s, i) => {
                  const done = i < stepIndex;
                  const active = i === stepIndex;
                  return (
                    <div key={s} style={{
                      display: 'flex', alignItems: 'center', gap: 10,
                      fontSize: 12, fontWeight: active ? 700 : 500,
                      color: done ? 'var(--gray5)' : active ? 'var(--navy)' : 'var(--gray4)',
                      opacity: !done && !active ? 0.55 : 1,
                      transition: 'opacity .2s, color .2s',
                    }}>
                      <span style={{
                        width: 16, height: 16, borderRadius: '50%',
                        background: done ? 'var(--green)' : active ? 'var(--navy)' : 'var(--gray2)',
                        color: '#fff',
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        fontSize: 9, fontWeight: 800, flexShrink: 0,
                      }}>{done ? '✓' : active ? '·' : ''}</span>
                      {s}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        ) : (
          <>
            <div style={{
              display: 'inline-flex', alignItems: 'center', gap: 6,
              fontSize: 10, fontWeight: 800, color: 'var(--amber)',
              background: 'var(--amber-bg)', padding: '4px 10px', borderRadius: 100,
              marginBottom: 12, letterSpacing: '0.6px',
            }}>
              <span style={{ width: 6, height: 6, borderRadius: '50%', background: 'var(--amber)' }} />
              추가 입력 필요
            </div>
            <div style={{ fontSize: 19, fontWeight: 900, letterSpacing: '-0.3px', marginBottom: 6 }}>
              최종 문서로 이동하려면<br />몇 가지 정보가 더 필요해요
            </div>
            <div style={{ fontSize: 12, color: 'var(--gray5)', lineHeight: 1.65, marginBottom: 18 }}>
              아래 항목을 입력하면 바로 PDF 단계로 이동합니다.
              {payerMissing.includes('studentId') && (
                <> 학생증(학번)은 양식의 <b>지출인</b> 필드에 자동으로 채워집니다.</>
              )}
            </div>

            {visiblePayerKeys.length > 0 && (
              <div style={{ marginBottom: formMissing.length > 0 ? 18 : 0 }}>
                <div style={{
                  fontSize: 10, fontWeight: 800, color: 'var(--gray4)',
                  letterSpacing: '0.8px', textTransform: 'uppercase', marginBottom: 10,
                }}>수령인 정보</div>

                {showCardUpload && (
                  <>
                    <input
                      ref={cardInputRef}
                      type="file"
                      accept="image/jpeg,image/jpg,image/png,image/webp"
                      style={{ display: 'none' }}
                      onChange={e => {
                        const f = e.target.files?.[0];
                        if (f) uploadStudentCard(f);
                        e.target.value = '';
                      }}
                    />
                    <div
                      onClick={() => { if (!cardAnalyzing) cardInputRef.current?.click(); }}
                      style={{
                        border: cardError
                          ? '1.5px dashed var(--red)'
                          : cardExtracted.size > 0
                          ? '1.5px solid var(--blue)'
                          : '1.5px dashed var(--blue)',
                        background: cardError ? 'var(--red-bg)' : 'var(--blue-pale)',
                        borderRadius: 10, padding: '14px 16px', marginBottom: 12,
                        textAlign: cardPreview ? 'left' : 'center',
                        cursor: cardAnalyzing ? 'wait' : 'pointer',
                        transition: 'all .2s',
                      }}
                    >
                      {cardAnalyzing ? (
                        <div style={{ textAlign: 'center' }}>
                          <div style={{
                            width: 24, height: 24, margin: '2px auto 8px',
                            border: '3px solid var(--gray2)', borderTopColor: 'var(--navy)',
                            borderRadius: '50%', animation: 'fco-spin 0.9s linear infinite',
                          }} />
                          <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--navy)' }}>
                            학생증 분석 중...
                          </div>
                          <div style={{ fontSize: 11, color: 'var(--gray5)', marginTop: 3 }}>
                            이름과 학번을 인식하고 있어요
                          </div>
                        </div>
                      ) : cardPreview ? (
                        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                          <img src={cardPreview} alt="학생증" style={{
                            width: 56, height: 56, objectFit: 'cover',
                            borderRadius: 6, border: '1px solid var(--gray2)', flexShrink: 0,
                          }} />
                          <div style={{ flex: 1, minWidth: 0 }}>
                            <div style={{
                              fontSize: 12, fontWeight: 700, color: 'var(--navy)',
                              marginBottom: 3, display: 'flex', alignItems: 'center', gap: 6,
                            }}>
                              {cardExtracted.size > 0 ? (
                                <>
                                  <span style={{ color: 'var(--green)' }}>✓ 인식 완료</span>
                                  <span style={{ fontSize: 10, color: 'var(--gray4)', fontWeight: 500 }}>
                                    {cardExtracted.size}개 항목 자동 입력
                                  </span>
                                </>
                              ) : (
                                <span style={{
                                  overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                                  display: 'block',
                                }}>{cardFileName}</span>
                              )}
                            </div>
                            <div style={{ fontSize: 11, color: 'var(--gray5)' }}>
                              {cardExtracted.size > 0
                                ? '값이 정확한지 확인하세요'
                                : '다른 사진으로 다시 시도'}
                            </div>
                          </div>
                          <span style={{
                            fontSize: 11, color: 'var(--blue)', fontWeight: 700,
                            padding: '5px 10px', borderRadius: 6,
                            border: '1px solid #C8D6E8', background: '#fff', flexShrink: 0,
                          }}>다시 선택</span>
                        </div>
                      ) : (
                        <>
                          <div style={{ fontSize: 22, marginBottom: 4 }}>🪪</div>
                          <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--navy)', marginBottom: 3 }}>
                            학생증 사진으로 자동 입력
                          </div>
                          <div style={{ fontSize: 11, color: 'var(--gray5)' }}>
                            학생증을 올리면 이름·학번을 자동으로 인식합니다
                          </div>
                        </>
                      )}
                    </div>

                    {cardError && (
                      <div style={{
                        fontSize: 11, color: 'var(--red)',
                        background: 'var(--red-bg)', border: '1px solid #F5C6C6',
                        borderRadius: 6, padding: '6px 10px', marginBottom: 12,
                      }}>{cardError}</div>
                    )}

                    <div style={{
                      display: 'flex', alignItems: 'center', gap: 10,
                      margin: '10px 0 12px', fontSize: 10, fontWeight: 700,
                      color: 'var(--gray4)', letterSpacing: '0.8px',
                    }}>
                      <div style={{ flex: 1, height: 1, background: 'var(--gray2)' }} />
                      또는 직접 입력
                      <div style={{ flex: 1, height: 1, background: 'var(--gray2)' }} />
                    </div>
                  </>
                )}

                <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                  {visiblePayerKeys.map(k => {
                    const isStudentId = k === 'studentId';
                    const isMono = k === 'studentId' || k === 'phone';
                    const extracted = cardExtracted.has(k);
                    return (
                      <div key={k}>
                        <label style={{
                          display: 'flex', alignItems: 'center',
                          fontSize: 11, fontWeight: 700,
                          color: isStudentId ? 'var(--navy)' : 'var(--gray5)', marginBottom: 5,
                        }}>
                          {PAYER_LABEL[k]}
                          {isStudentId && (
                            <span style={{
                              marginLeft: 6, fontSize: 9, fontWeight: 800,
                              padding: '2px 6px', borderRadius: 4,
                              background: 'var(--navy)', color: '#fff', letterSpacing: '0.4px',
                            }}>학생증</span>
                          )}
                          {extracted && (
                            <span style={{
                              marginLeft: 'auto', fontSize: 9, fontWeight: 800,
                              padding: '2px 6px', borderRadius: 4,
                              background: '#fff', color: 'var(--blue)',
                              border: '1px solid #C8D6E8', letterSpacing: '0.3px',
                            }}>✓ 학생증에서 추출</span>
                          )}
                        </label>
                        <input
                          autoFocus={isStudentId && !showCardUpload}
                          value={payer[k]}
                          onChange={e => {
                            const v = e.target.value;
                            setPayer(p => ({ ...p, [k]: v }));
                            if (cardExtracted.has(k)) {
                              setCardExtracted(prev => {
                                const next = new Set(prev);
                                next.delete(k);
                                return next;
                              });
                            }
                          }}
                          placeholder={PAYER_PLACEHOLDER[k]}
                          style={{
                            width: '100%',
                            border: extracted ? '1.5px solid var(--blue)' : '1.5px solid var(--gray2)',
                            borderRadius: 8, padding: '10px 12px', fontSize: 13,
                            fontFamily: isMono ? 'var(--font-mono)' : 'inherit',
                            color: 'var(--navy)',
                            background: extracted ? 'var(--blue-pale)' : '#fff',
                            outline: 'none',
                          }}
                        />
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {formMissing.length > 0 && (
              <div>
                <div style={{
                  fontSize: 10, fontWeight: 800, color: 'var(--gray4)',
                  letterSpacing: '0.8px', textTransform: 'uppercase', marginBottom: 10,
                }}>양식 필수 항목</div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                  {formMissing.map(k => (
                    <div key={k}>
                      <label style={{
                        display: 'block', fontSize: 11, fontWeight: 700,
                        color: 'var(--gray5)', marginBottom: 5,
                      }}>{k}</label>
                      <input
                        value={formValues[k] ?? ''}
                        onChange={e => setFormValues(v => ({ ...v, [k]: e.target.value }))}
                        placeholder={`${k} 값을 입력하세요`}
                        style={{
                          width: '100%', border: '1.5px solid var(--gray2)', borderRadius: 8,
                          padding: '10px 12px', fontSize: 13,
                          color: 'var(--navy)', background: '#fff', outline: 'none',
                        }}
                      />
                    </div>
                  ))}
                </div>
              </div>
            )}

            {error && (
              <div style={{
                fontSize: 12, color: 'var(--red)',
                background: 'var(--red-bg)', border: '1px solid #F5C6C6',
                borderRadius: 8, padding: '8px 12px', marginTop: 14,
              }}>{error}</div>
            )}

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1.5fr', gap: 10, marginTop: 20 }}>
              <button
                onClick={onClose}
                style={{
                  background: '#fff', color: 'var(--navy)',
                  border: '1.5px solid var(--gray2)', borderRadius: 10,
                  padding: '11px 16px', fontSize: 13, fontWeight: 700,
                  cursor: 'pointer', fontFamily: 'inherit',
                }}
              >나중에 입력</button>
              <button
                onClick={handleSubmit}
                style={{
                  background: 'var(--navy)', color: '#fff',
                  border: '1.5px solid var(--navy)', borderRadius: 10,
                  padding: '11px 16px', fontSize: 13, fontWeight: 800,
                  cursor: 'pointer', fontFamily: 'inherit',
                  boxShadow: '0 6px 16px rgba(28,43,74,.22)',
                }}
              >저장하고 최종 문서로 →</button>
            </div>
          </>
        )}
      </div>

      <style>{`
        @keyframes fco-spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
      `}</style>
    </div>
  );
}
