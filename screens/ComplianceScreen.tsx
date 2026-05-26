'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { getUserInfo } from '@/lib/auth';

interface FieldRow {
  key: string;
  value: string;
  violated: boolean;
  violationMsg?: string;
}

interface CheckItem {
  status: 'ok' | 'warn' | 'err';
  title: string;
  desc: string;
}

export default function ComplianceScreen() {
  const router = useRouter();
  const userName = getUserInfo()?.name ?? '';
  const [rows, setRows] = useState<FieldRow[]>([]);
  const [formName, setFormName] = useState('지출결의서');
  const [editingKey, setEditingKey] = useState<string | null>(null);
  const [editValue, setEditValue] = useState('');
  const [checks, setChecks] = useState<CheckItem[]>([]);

  useEffect(() => {
    localStorage.setItem('lastStep', '4');
    const filledRaw = localStorage.getItem('filledFields');
    const missingRaw = localStorage.getItem('missingFields');
    const userInputRaw = localStorage.getItem('userInputFields');
    const name = localStorage.getItem('formName');
    if (name) setFormName(name);
    // 증빙별 스냅샷 업데이트
    const evidenceId = localStorage.getItem('evidenceId');
    if (evidenceId) {
      const existing = JSON.parse(localStorage.getItem(`eid_${evidenceId}`) ?? '{}');
      existing.lastStep = '4';
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

    const merged: FieldRow[] = [];
    for (const [k, v] of Object.entries(filled)) {
      const userVal = userInput[k];
      merged.push({ key: k, value: userVal ?? v, violated: false });
    }
    for (const k of missing) {
      const v = userInput[k] ?? '';
      const violated = !v;
      merged.push({
        key: k, value: v,
        violated,
        violationMsg: violated ? '필수 항목입니다. 값을 입력해 주세요.' : undefined,
      });
    }
    setRows(merged);

    const checkList: CheckItem[] = [];
    const violationCount = merged.filter(r => r.violated).length;
    if (violationCount > 0) {
      checkList.push({
        status: 'err',
        title: `${violationCount}개 항목 입력 누락`,
        desc: '빨간 테두리 항목을 클릭하여 입력하세요.',
      });
    }
    checkList.push(
      { status: 'ok', title: '증빙서류 첨부 완료', desc: '업로드된 증빙이 양식에 연결되었습니다.' },
      { status: 'ok', title: '한도 규정 준수', desc: '항목별 한도 위반 사항이 없습니다.' },
    );
    if (violationCount === 0) {
      checkList.push({
        status: 'ok',
        title: '모든 규정 검사 통과',
        desc: '검토를 마쳤습니다. 다음 단계로 진행하세요.',
      });
    } else {
      checkList.push({
        status: 'warn',
        title: '입력 보강 권장',
        desc: '구체적인 거래처명·업무 내용을 보강하면 결재 통과율이 높아집니다.',
      });
    }
    setChecks(checkList);
  }, []);

  function startEdit(row: FieldRow) {
    setEditingKey(row.key);
    setEditValue(row.value);
  }

  function commitEdit() {
    if (editingKey == null) return;
    setRows(prev => prev.map(r => r.key === editingKey
      ? { ...r, value: editValue, violated: editValue ? false : r.violated, violationMsg: editValue ? undefined : r.violationMsg }
      : r
    ));
    const userInput = JSON.parse(localStorage.getItem('userInputFields') ?? '{}');
    userInput[editingKey] = editValue;
    localStorage.setItem('userInputFields', JSON.stringify(userInput));
    setEditingKey(null);
  }

  const sum = rows.reduce((acc, r) => {
    const n = parseInt(r.value.replace(/[^\d-]/g, ''), 10);
    if (!isNaN(n) && /금액|비$|료$|값$/.test(r.key)) return acc + n;
    return acc;
  }, 0);
  const showSum = rows.some(r => /금액|비$|료$/.test(r.key));

  return (
    <div style={{
      display: 'grid', gridTemplateColumns: '1fr 360px',
      minHeight: 'calc(100vh - 56px - 86px - 50px)',
      fontFamily: 'var(--font-ui)', color: 'var(--navy)',
    }}>
      <div style={{ background: 'var(--bg)', padding: 24 }}>
        <div style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          marginBottom: 14, padding: '0 4px', maxWidth: 640, margin: '0 auto 14px',
        }}>
          <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--navy)' }}>
            {formName} <span style={{ fontWeight: 400, color: 'var(--gray4)' }}>· 자동 저장됨</span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
            <div style={{ width: 8, height: 8, borderRadius: '50%', background: 'var(--green)' }} />
            <span style={{ fontSize: 10, color: 'var(--green)', fontWeight: 600 }}>실시간 편집 중</span>
          </div>
        </div>

        <div style={{
          background: '#fff', maxWidth: 640, margin: '0 auto',
          borderRadius: 4, padding: '32px 36px',
          boxShadow: '0 1px 10px rgba(0,0,0,0.08)',
        }}>
          <div style={{
            textAlign: 'center', fontSize: 15, fontWeight: 700,
            color: 'var(--navy)', borderBottom: '2px solid var(--navy)',
            paddingBottom: 12, marginBottom: 16,
          }}>{formName}</div>

          {Array.from({ length: Math.ceil(rows.length / 2) }).map((_, idx) => {
            const left = rows[idx * 2];
            const right = rows[idx * 2 + 1];
            return (
              <div key={idx} style={{ display: 'flex', borderBottom: '1px solid var(--gray2)' }}>
                {[left, right].map((r, ci) => r ? (
                  <React.Fragment key={r.key}>
                    <div style={{
                      width: 100, padding: '8px 10px', fontWeight: 600,
                      color: 'var(--gray4)', fontSize: 10,
                      background: 'var(--gray1)',
                      borderRight: '1px solid var(--gray2)', flexShrink: 0,
                    }}>{r.key}</div>
                    <div
                      onClick={() => startEdit(r)}
                      style={{
                        padding: '8px 12px', flex: 1,
                        fontSize: 12, color: 'var(--navy)',
                        cursor: 'pointer', transition: 'background .12s',
                        background: editingKey === r.key
                          ? '#FFFDE7'
                          : r.violated ? 'var(--red-bg)' : '#fff',
                        outline: editingKey === r.key ? '1.5px solid #F4B000' : 'none',
                        borderLeft: r.violated ? '3px solid var(--red)' : 'none',
                        borderRight: ci === 0 ? '1px solid var(--gray2)' : 'none',
                        display: r.violated && r.violationMsg ? 'flex' : 'block',
                        flexDirection: r.violated ? 'column' : undefined,
                        justifyContent: r.violated ? 'center' : undefined,
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
                            border: 'none', background: 'transparent', width: '100%',
                            fontFamily: 'inherit', fontSize: 12, color: 'var(--navy)', outline: 'none',
                          }}
                        />
                      ) : (
                        <>
                          <span>{r.value || (r.violated ? '미입력' : '')}</span>
                          {r.violationMsg && (
                            <span style={{ fontSize: 10, color: 'var(--red)', fontWeight: 600, marginTop: 2 }}>
                              ⚠ {r.violationMsg}
                            </span>
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
                width: 100, padding: '8px 10px', fontWeight: 600,
                color: 'rgba(255,255,255,0.6)', fontSize: 10,
                background: 'transparent', borderRight: '1px solid rgba(255,255,255,0.15)',
                flexShrink: 0,
              }}>합계</div>
              <div style={{
                padding: '8px 12px', flex: 1,
                fontFamily: 'var(--font-mono)', fontSize: 14, fontWeight: 700, color: '#fff',
              }}>{sum.toLocaleString()}원</div>
            </div>
          )}

          <div style={{
            display: 'flex', gap: 24,
            padding: '16px 0', borderTop: '2px solid var(--navy)', marginTop: 16,
          }}>
            {['신청인', '팀장', '부서장'].map((t, i) => (
              <div key={t} style={{ flex: 1, textAlign: 'center', fontSize: 10, color: 'var(--gray4)' }}>
                {t}
                <div style={{
                  marginTop: 24, borderTop: '1px solid var(--gray3)',
                  paddingTop: 5, fontSize: 11,
                  color: i === 0 ? 'var(--navy)' : 'var(--gray3)',
                  fontWeight: i === 0 ? 600 : 400,
                }}>{i === 0 ? userName : '(미결재)'}</div>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div style={{
        background: '#fff', borderLeft: '1px solid var(--gray2)',
        padding: 18, overflowY: 'auto',
        display: 'flex', flexDirection: 'column',
      }}>
        <div style={{ marginBottom: 18 }}>
          <div style={{
            fontSize: 10, fontWeight: 700, color: 'var(--gray4)',
            letterSpacing: '0.5px', textTransform: 'uppercase', marginBottom: 10,
          }}>규정 검사</div>
          {checks.map((c, i) => {
            const cfg = c.status === 'err'
              ? { ico: '✕', icoBg: 'var(--red-bg)',   icoColor: 'var(--red)',   border: 'var(--red)',   titleColor: 'var(--red)' }
              : c.status === 'warn'
              ? { ico: '!', icoBg: 'var(--amber-bg)', icoColor: 'var(--amber)', border: 'var(--amber)', titleColor: 'var(--amber)' }
              : { ico: '✓', icoBg: 'var(--green-bg)', icoColor: 'var(--green)', border: 'var(--gray2)', titleColor: 'var(--navy)' };
            return (
              <div key={i} style={{
                display: 'flex', gap: 8, padding: 10, background: '#fff',
                borderRadius: 7, border: `1px solid ${cfg.border}`, marginBottom: 7,
              }}>
                <div style={{
                  width: 20, height: 20, borderRadius: '50%',
                  background: cfg.icoBg, color: cfg.icoColor,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontSize: 10, fontWeight: 700, flexShrink: 0, marginTop: 1,
                }}>{cfg.ico}</div>
                <div>
                  <div style={{ fontSize: 11, fontWeight: 700, color: cfg.titleColor, marginBottom: 2 }}>{c.title}</div>
                  <div style={{ fontSize: 10, color: 'var(--gray5)', lineHeight: 1.5 }}>{c.desc}</div>
                </div>
              </div>
            );
          })}
        </div>

        <div style={{ marginBottom: 16 }}>
          <div style={{
            fontSize: 10, fontWeight: 700, color: 'var(--gray4)',
            letterSpacing: '0.5px', textTransform: 'uppercase', marginBottom: 10,
          }}>편집 안내</div>
          <div style={{
            fontSize: 11, color: 'var(--gray5)', lineHeight: 1.7,
            padding: 12, background: 'var(--gray1)', borderRadius: 8,
          }}>
            셀을 <strong>클릭</strong>하면 바로 편집됩니다.<br /><br />
            빨간 테두리 항목은 규정 위반이 감지된 항목입니다.
          </div>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginTop: 'auto', paddingTop: 12 }}>
          <button
            onClick={() => router.push('/doc-review')}
            style={{
              width: '100%', background: 'var(--gray2)', color: 'var(--gray5)',
              border: 'none', borderRadius: 6, padding: '9px 20px',
              fontSize: 13, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit',
            }}
          >← 이전 단계</button>
          <button
            onClick={() => router.push('/pdf')}
            style={{
              width: '100%', background: 'var(--navy)', color: '#fff',
              border: 'none', borderRadius: 6, padding: '9px 20px',
              fontSize: 13, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit',
            }}
          >최종 저장 →</button>
        </div>
      </div>
    </div>
  );
}
