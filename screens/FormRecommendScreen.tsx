'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { apiFetch } from '@/lib/api';

interface AvailableForm {
  formId: number;
  formName: string;
  description?: string;
  paymentType?: string;
  fields?: string[];
  matchScore?: number;
}

const RANK_LABEL = ['추천 1위', '추천 2위', '추천 3위', '추천 4위'];

export default function FormRecommendScreen() {
  const router = useRouter();
  const [forms, setForms] = useState<AvailableForm[]>([]);
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    const raw = sessionStorage.getItem('availableForms');
    if (!raw) {
      setError('이전 단계의 분석 정보가 없습니다. 처음부터 진행해 주세요.');
      return;
    }
    try {
      const parsed: AvailableForm[] = JSON.parse(raw);
      setForms(parsed);
      if (parsed.length > 0) setSelectedId(parsed[0].formId);
    } catch { setError('데이터를 불러오지 못했습니다.'); }
  }, []);

  async function goNext() {
    const evidenceId = sessionStorage.getItem('evidenceId');
    if (!evidenceId || selectedId == null) {
      setError('양식을 선택해 주세요.');
      return;
    }
    setSubmitting(true); setError('');
    try {
      const res = await apiFetch(`/api/evidence/${evidenceId}/fill`, {
        method: 'POST',
        body: JSON.stringify({ formIds: [selectedId] }),
      });
      if (res.ok) {
        const data: { results: { formId: number; formName: string; filledFields: Record<string, string>; missingFields: string[] }[] } = await res.json();
        const first = data.results[0];
        if (first) {
          sessionStorage.setItem('filledFields', JSON.stringify(first.filledFields));
          sessionStorage.setItem('missingFields', JSON.stringify(first.missingFields));
          sessionStorage.setItem('formId', String(first.formId));
          sessionStorage.setItem('formName', first.formName);
        }
        router.push('/doc-review');
      } else {
        const body = await res.json().catch(() => null);
        setError(body?.error ?? '양식 분석에 실패했습니다.');
      }
    } catch { setError('서버에 연결할 수 없습니다.'); }
    finally { setSubmitting(false); }
  }

  function getScore(f: AvailableForm): number {
    return Math.round((f.matchScore ?? 0) * 100);
  }

  return (
    <div style={{ fontFamily: 'var(--font-ui)', padding: '28px 32px', color: 'var(--navy)' }}>
      {/* AI 스트립 */}
      <div style={{
        background: 'var(--navy)', borderRadius: 10,
        padding: '14px 18px',
        display: 'flex', alignItems: 'center', gap: 12, marginBottom: 22,
      }}>
        <div style={{
          width: 32, height: 32, borderRadius: '50%',
          background: 'rgba(255,255,255,0.12)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontSize: 12, fontWeight: 700, color: '#fff', flexShrink: 0,
        }}>AI</div>
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: 13, fontWeight: 700, color: '#fff', marginBottom: 2 }}>증빙자료 분석 완료</div>
          <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.6)' }}>
            증빙자료를 토대로 가장 적합한 양식을 추천합니다.
          </div>
        </div>
        <span style={{
          display: 'inline-flex', alignItems: 'center',
          fontSize: 10, fontWeight: 700, padding: '2px 8px', borderRadius: 100,
          background: 'var(--green-bg)', color: 'var(--green)',
        }}>추천 완료</span>
      </div>

      <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--navy)', marginBottom: 16 }}>
        추천 양식지 <span style={{ fontWeight: 400, color: 'var(--gray4)' }}>({forms.length}종)</span>
      </div>

      {forms.length === 0 ? (
        <div style={{
          background: '#fff', border: '1px solid var(--gray2)',
          borderRadius: 12, padding: 32, textAlign: 'center',
          fontSize: 13, color: 'var(--gray4)', marginBottom: 24,
        }}>
          추천할 양식이 없습니다. 양식지 메뉴에서 양식을 먼저 등록해 주세요.
        </div>
      ) : (
        <div style={{
          display: 'grid', gridTemplateColumns: `repeat(${Math.min(forms.length, 3)}, 1fr)`,
          gap: 16, marginBottom: 24,
        }}>
          {forms.map((f, idx) => {
            const sel = f.formId === selectedId;
            const rankBadge = idx === 0
              ? { bg: 'var(--navy)', color: '#fff' }
              : idx === 1
              ? { bg: 'var(--blue-pale)', color: 'var(--blue)' }
              : { bg: 'var(--gray2)', color: 'var(--gray4)' };
            const score = getScore(f);
            const scoreBadge = score >= 90
              ? { bg: 'var(--green-bg)', color: 'var(--green)' }
              : { bg: 'var(--gray2)', color: 'var(--gray4)' };
            return (
              <div
                key={f.formId}
                onClick={() => setSelectedId(f.formId)}
                style={{
                  border: sel ? '2px solid var(--navy)' : '2px solid var(--gray2)',
                  borderRadius: 12, padding: 16,
                  background: sel ? 'var(--blue-pale)' : '#fff',
                  cursor: 'pointer', transition: 'all .15s',
                }}
              >
                <div style={{
                  display: 'flex', justifyContent: 'space-between', marginBottom: 9,
                }}>
                  <span style={{
                    display: 'inline-flex', fontSize: 10, fontWeight: 700,
                    padding: '2px 8px', borderRadius: 100,
                    background: rankBadge.bg, color: rankBadge.color,
                  }}>{RANK_LABEL[idx] ?? `추천 ${idx + 1}위`}</span>
                  <span style={{
                    display: 'inline-flex', fontSize: 10, fontWeight: 700,
                    padding: '2px 8px', borderRadius: 100,
                    background: scoreBadge.bg, color: scoreBadge.color,
                  }}>{score}% 적합</span>
                </div>
                <div style={{
                  background: 'var(--gray1)', borderRadius: 8, height: 90,
                  display: 'flex', flexDirection: 'column',
                  alignItems: 'center', justifyContent: 'center',
                  gap: 5, marginBottom: 10, padding: '0 16px',
                }}>
                  {[0.75, 0.85, 0.65, 0.80].map((w, i) => (
                    <div key={i} style={{
                      height: 3, borderRadius: 2,
                      background: idx === 0 && i === 0 ? 'var(--navy)' : 'var(--gray3)',
                      width: `${w * 100}%`,
                    }} />
                  ))}
                </div>
                <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--navy)', marginBottom: 3 }}>{f.formName}</div>
                <div style={{ fontSize: 11, color: 'var(--gray4)' }}>{f.description ?? '추천된 양식'}</div>
              </div>
            );
          })}
        </div>
      )}

      {error && (
        <div style={{
          fontSize: 12, color: 'var(--red)',
          background: 'var(--red-bg)', border: '1px solid #F5C6C6',
          borderRadius: 6, padding: '8px 12px', marginBottom: 16,
        }}>{error}</div>
      )}

      <div style={{ display: 'flex', justifyContent: 'space-between' }}>
        <button
          onClick={() => router.push('/receipt')}
          style={{
            background: 'transparent', color: 'var(--navy)',
            border: '1.5px solid var(--navy)', borderRadius: 6,
            padding: '9px 20px', fontSize: 13, fontWeight: 600,
            cursor: 'pointer', fontFamily: 'inherit',
          }}
        >직접 선택</button>
        <button
          onClick={goNext}
          disabled={selectedId == null || submitting}
          style={{
            background: 'var(--navy)', color: '#fff', border: 'none',
            borderRadius: 6, padding: '11px 28px',
            fontSize: 14, fontWeight: 600,
            cursor: (selectedId == null || submitting) ? 'not-allowed' : 'pointer',
            fontFamily: 'inherit',
            opacity: (selectedId == null || submitting) ? 0.6 : 1,
          }}
        >{submitting ? '처리 중...' : '선택 완료 · 자동 입력 시작 →'}</button>
      </div>
    </div>
  );
}
