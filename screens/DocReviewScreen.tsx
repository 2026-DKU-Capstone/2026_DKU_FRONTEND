'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import FinalCheckOverlay from '@/components/FinalCheckOverlay';
import { apiFetch } from '@/lib/api';
import { getGroupId } from '@/lib/group';
import { getUserInfo } from '@/lib/auth';

interface FieldRow {
  key: string;
  value: string;
  isAi: boolean;       // AI auto-filled
  missing: boolean;    // user must input
}

export default function DocReviewScreen() {
  const router = useRouter();
  const userName = getUserInfo()?.name ?? '';
  const [rows, setRows] = useState<FieldRow[]>([]);
  const [formName, setFormName] = useState('지출결의서');
  const [editingKey, setEditingKey] = useState<string | null>(null);
  const [editValue, setEditValue] = useState('');
  const [finalCheckOpen, setFinalCheckOpen] = useState(false);

  useEffect(() => {
    localStorage.setItem('lastStep', '3');
    const filledRaw = localStorage.getItem('filledFields');
    const missingRaw = localStorage.getItem('missingFields');
    const userInputRaw = localStorage.getItem('userInputFields');
    const name = localStorage.getItem('formName');
    if (name) setFormName(name);
    // 증빙별 스냅샷 업데이트
    const evidenceId = localStorage.getItem('evidenceId');
    if (evidenceId) {
      const existing = JSON.parse(localStorage.getItem(`eid_${evidenceId}`) ?? '{}');
      existing.lastStep = '3';
      if (filledRaw) existing.filledFields = filledRaw;
      if (missingRaw) existing.missingFields = missingRaw;
      if (userInputRaw) existing.userInputFields = userInputRaw;
      if (name) existing.formName = name;
      existing.formId = localStorage.getItem('formId') ?? existing.formId;
      localStorage.setItem(`eid_${evidenceId}`, JSON.stringify(existing));
    }

    const filled: Record<string, string> = filledRaw ? JSON.parse(filledRaw) : {};
    const missing: string[] = missingRaw ? JSON.parse(missingRaw) : [];
    const userInput: Record<string, string> = userInputRaw ? JSON.parse(userInputRaw) : {};

    const result: FieldRow[] = [];
    for (const [k, v] of Object.entries(filled)) {
      result.push({ key: k, value: v, isAi: true, missing: false });
    }
    for (const k of missing) {
      result.push({ key: k, value: userInput[k] ?? '', isAi: false, missing: true });
    }
    setRows(result);

    // 진입 시 누락된 정보(수령인 / 양식 필수 항목)가 있으면 로딩 모달을 자동으로 띄움.
    // 부족 없으면 모달을 띄우지 않고 사용자가 평소처럼 셀을 직접 편집할 수 있게 둔다.
    (async () => {
      const formMissing = missing.some(k => !(userInput[k] ?? '').trim());

      let payerMissing = true;
      try {
        const groupId = getGroupId();
        if (groupId) {
          const res = await apiFetch(`/api/groups/${groupId}`);
          if (res.ok) {
            const data = await res.json();
            const p = data?.payerInfo;
            payerMissing = !(
              p &&
              (p.name ?? '').trim() &&
              (p.affiliation ?? '').trim() &&
              (p.studentId ?? '').trim() &&
              (p.phone ?? '').trim()
            );
          }
        }
      } catch { /* 조회 실패 → 부족으로 간주 */ }

      if (formMissing || payerMissing) setFinalCheckOpen(true);
    })();
  }, []);

  function startEdit(row: FieldRow) {
    setEditingKey(row.key);
    setEditValue(row.value);
  }

  function commitEdit() {
    if (editingKey == null) return;
    setRows(prev => prev.map(r => {
      if (r.key !== editingKey) return r;
      const next: FieldRow = { ...r, value: editValue, isAi: false };
      return next;
    }));
    // user input fields 저장 (filledFields 도 사용자가 수정 시 user override 로 분류)
    const updated: Record<string, string> = {};
    rows.forEach(r => { updated[r.key] = r.key === editingKey ? editValue : r.value; });
    const userInput = JSON.parse(localStorage.getItem('userInputFields') ?? '{}');
    userInput[editingKey] = editValue;
    localStorage.setItem('userInputFields', JSON.stringify(userInput));
    setEditingKey(null);
  }

  // 합계 자동 계산 (금액 필드만)
  const sum = rows.reduce((acc, r) => {
    const n = parseInt(r.value.replace(/[^\d-]/g, ''), 10);
    if (!isNaN(n) && /금액|비$|료$|값$/.test(r.key)) return acc + n;
    return acc;
  }, 0);
  const showSum = rows.some(r => /금액|비$|료$/.test(r.key));

  const aiCount = rows.filter(r => r.isAi).length;
  const missingCount = rows.filter(r => r.missing && !r.value).length;

  return (
    <div style={{
      display: 'grid', gridTemplateColumns: '1fr 360px',
      minHeight: 'calc(100vh - 56px - 86px - 50px)',
      fontFamily: 'var(--font-ui)', color: 'var(--navy)',
    }}>
      <div style={{ background: 'var(--bg)', padding: 28 }}>
        <div style={{
          maxWidth: 680, margin: '0 auto 14px',
          background: 'var(--blue-pale)', border: '1px solid #C8D6E8',
          borderRadius: 10, padding: '12px 16px',
          display: 'flex', alignItems: 'center', gap: 10,
          fontSize: 12, color: 'var(--navy)',
        }}>
          <span style={{
            width: 8, height: 8, borderRadius: '50%',
            background: 'var(--navy)', animation: 'pulse 1.4s infinite',
          }} />
          <span><b>AI가 업로드된 증빙자료를 분석해 초안을 자동 작성했어요.</b> 셀을 클릭해 자유롭게 수정할 수 있습니다.</span>
        </div>

        <div style={{
          background: '#fff', maxWidth: 680, margin: '0 auto',
          borderRadius: 6, padding: '36px 40px',
          boxShadow: '0 1px 12px rgba(0,0,0,0.08)',
        }}>
          <div style={{
            textAlign: 'center', fontSize: 17, fontWeight: 800,
            color: 'var(--navy)', borderBottom: '2.5px solid var(--navy)',
            paddingBottom: 14, marginBottom: 18, letterSpacing: '-0.3px',
          }}>{formName}</div>

          {rows.length === 0 ? (
            <div style={{ padding: '40px 0', textAlign: 'center', fontSize: 13, color: 'var(--gray4)' }}>
              증빙 업로드 후 자동 입력된 내용이 표시됩니다.
            </div>
          ) : (
            <>
              {Array.from({ length: Math.ceil(rows.length / 2) }).map((_, idx) => {
                const left = rows[idx * 2];
                const right = rows[idx * 2 + 1];
                return (
                  <div key={idx} style={{ display: 'flex', borderBottom: '1px solid var(--gray2)' }}>
                    {[left, right].map((r, ci) => r ? (
                      <React.Fragment key={r.key}>
                        <div style={{
                          width: 110, padding: '10px 12px', fontWeight: 600,
                          color: 'var(--gray4)', fontSize: 11,
                          background: 'var(--gray1)',
                          borderRight: '1px solid var(--gray2)', flexShrink: 0,
                        }}>{r.key}</div>
                        <div
                          onClick={() => startEdit(r)}
                          style={{
                            padding: '10px 14px', flex: 1,
                            fontSize: 13, color: 'var(--navy)',
                            cursor: 'pointer', transition: '.12s',
                            position: 'relative',
                            background: editingKey === r.key
                              ? '#FFFDE7'
                              : r.missing && !r.value ? '#FFFBF0' : '#fff',
                            outline: editingKey === r.key ? '1.5px solid #F4B000' : 'none',
                            borderRight: ci === 0 ? '1px solid var(--gray2)' : 'none',
                          }}
                          onMouseEnter={e => {
                            if (editingKey !== r.key) e.currentTarget.style.background = 'var(--blue-pale)';
                          }}
                          onMouseLeave={e => {
                            if (editingKey !== r.key) {
                              e.currentTarget.style.background = r.missing && !r.value ? '#FFFBF0' : '#fff';
                            }
                          }}
                        >
                          {editingKey === r.key ? (
                            <input
                              autoFocus
                              value={editValue}
                              onChange={e => setEditValue(e.target.value)}
                              onBlur={commitEdit}
                              onKeyDown={e => { if (e.key === 'Enter') commitEdit(); }}
                              style={{
                                border: 'none', background: 'transparent',
                                width: '100%', fontFamily: 'inherit', fontSize: 13,
                                color: 'var(--navy)', outline: 'none',
                              }}
                            />
                          ) : (
                            <>
                              {r.value || (r.missing ? <span style={{ color: 'var(--gray3)' }}>입력하세요</span> : '')}
                              {r.isAi && (
                                <span style={{
                                  position: 'absolute', right: 10, top: '50%',
                                  transform: 'translateY(-50%)',
                                  fontSize: 9, fontWeight: 800, color: 'var(--blue)',
                                  background: '#fff', padding: '2px 6px',
                                  borderRadius: 4, border: '1px solid var(--blue-pale)',
                                }}>AI</span>
                              )}
                            </>
                          )}
                        </div>
                      </React.Fragment>
                    ) : (
                      <div key={ci} style={{ flex: 1 }} />
                    ))}
                  </div>
                );
              })}

              {showSum && (
                <div style={{ display: 'flex', background: 'var(--navy)' }}>
                  <div style={{
                    width: 110, padding: '10px 12px', fontWeight: 600,
                    color: 'rgba(255,255,255,0.6)', fontSize: 11,
                    background: 'transparent', borderRight: '1px solid rgba(255,255,255,0.15)',
                    flexShrink: 0,
                  }}>합계</div>
                  <div style={{
                    padding: '10px 14px', flex: 1,
                    fontFamily: 'var(--font-mono)', fontSize: 15, fontWeight: 800, color: '#fff',
                  }}>{sum.toLocaleString()}원</div>
                </div>
              )}

              <div style={{
                display: 'flex', gap: 24,
                padding: '18px 0', borderTop: '2px solid var(--navy)', marginTop: 18,
              }}>
                {['신청인', '팀장', '부서장'].map((t, i) => (
                  <div key={t} style={{ flex: 1, textAlign: 'center', fontSize: 10, color: 'var(--gray4)' }}>
                    {t}
                    <div style={{
                      marginTop: 26, borderTop: '1px solid var(--gray3)',
                      paddingTop: 5, fontSize: 11,
                      color: i === 0 ? 'var(--navy)' : 'var(--gray3)',
                      fontWeight: i === 0 ? 600 : 400,
                    }}>{i === 0 ? userName : '(미결재)'}</div>
                  </div>
                ))}
              </div>
            </>
          )}
        </div>
      </div>

      {/* 사이드바 */}
      <div style={{
        background: '#fff', borderLeft: '1px solid var(--gray2)',
        padding: 22, display: 'flex', flexDirection: 'column',
      }}>
        <div style={{ marginBottom: 22 }}>
          <div style={{
            fontSize: 10, fontWeight: 800, color: 'var(--gray4)',
            letterSpacing: '0.6px', textTransform: 'uppercase', marginBottom: 12,
          }}>AI 자동 입력 결과</div>
          {[
            { ico: 'AI', icoBg: 'var(--blue-pale)', icoColor: 'var(--blue)',
              t: `${aiCount}개 항목 자동 추출 완료`,
              d: '증빙에서 인식한 값을 양식에 자동 입력했습니다.',
              titleColor: 'var(--navy)' },
            ...(missingCount > 0 ? [{ ico: '!', icoBg: 'var(--amber-bg)', icoColor: 'var(--amber)',
              t: `${missingCount}개 항목 입력 필요`,
              d: '미입력된 항목을 직접 채워주세요.',
              titleColor: 'var(--amber)' }] : []),
          ].map((c, i) => (
            <div key={i} style={{
              display: 'flex', gap: 10, padding: 12, background: '#fff',
              borderRadius: 9, border: '1px solid var(--gray2)', marginBottom: 8,
            }}>
              <div style={{
                width: 22, height: 22, borderRadius: '50%',
                background: c.icoBg, color: c.icoColor,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: 11, fontWeight: 700, flexShrink: 0, marginTop: 1,
              }}>{c.ico}</div>
              <div>
                <div style={{ fontSize: 12, fontWeight: 700, color: c.titleColor, marginBottom: 3 }}>{c.t}</div>
                <div style={{ fontSize: 11, color: 'var(--gray5)', lineHeight: 1.55 }}>{c.d}</div>
              </div>
            </div>
          ))}
        </div>

        <div style={{
          fontSize: 11, color: 'var(--gray5)', lineHeight: 1.7,
          padding: 12, background: 'var(--gray1)', borderRadius: 8, marginBottom: 18,
        }}>
          셀을 <strong>클릭</strong>하면 바로 편집할 수 있어요.<br />
          <span style={{ color: 'var(--blue)', fontWeight: 700 }}>AI</span> 표시는 증빙에서 자동 추출된 값입니다.
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginTop: 'auto' }}>
          <button
            onClick={() => router.push('/form-recommend')}
            style={{
              width: '100%', background: 'var(--gray2)', color: 'var(--gray5)',
              border: 'none', borderRadius: 10, padding: '10px 20px',
              fontSize: 13, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit',
            }}
          >← 이전 단계</button>
          <button
            onClick={() => router.push('/compliance')}
            style={{
              width: '100%', background: 'var(--navy)', color: '#fff',
              border: 'none', borderRadius: 10, padding: '10px 20px',
              fontSize: 13, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit',
            }}
          >다음 → 규정 검토</button>
        </div>
      </div>

      <FinalCheckOverlay
        open={finalCheckOpen}
        onClose={() => setFinalCheckOpen(false)}
        onProceed={() => { setFinalCheckOpen(false); router.push('/compliance'); }}
      />

      <style>{`
        @keyframes pulse { 0%,100% { opacity: 1; } 50% { opacity: .4; } }
      `}</style>
    </div>
  );
}
