'use client';

import React, { useState, useEffect } from 'react';

interface AvailableForm {
  formId: number;
  formName: string;
  description: string;
  paymentType: string;
  fields: string[];
}

const MOCK_FORMS: AvailableForm[] = [
  { formId: 1, formName: '국내 출장 경비 정산서', description: '숙박비·교통비·식비 종합 정산', paymentType: 'BOTH', fields: [] },
  { formId: 2, formName: '숙박비 지출결의서', description: '단일 숙박 항목 전용', paymentType: 'CASH', fields: [] },
  { formId: 3, formName: '일반 지출결의서', description: '범용 양식', paymentType: 'BOTH', fields: [] },
];

const RANK_BADGES = [
  { label: '추천 1위', bg: '#1C2B4A', color: '#fff' },
  { label: '추천 2위', bg: '#EAF0F8', color: '#4A6FA5' },
  { label: '추천 3위', bg: '#E2E7EF', color: '#8A96A8' },
];

const MATCH_BADGES = [
  { label: '98% 적합', bg: '#E8F5EE', color: '#3A8A5C' },
  { label: '82% 적합', bg: '#E2E7EF', color: '#8A96A8' },
  { label: '71% 적합', bg: '#E2E7EF', color: '#8A96A8' },
];

const PREVIEW_LINES: Record<number, { width: string; dark: boolean }[]> = {
  0: [
    { width: '75%', dark: true },
    { width: '85%', dark: false },
    { width: '65%', dark: false },
    { width: '80%', dark: false },
  ],
  1: [
    { width: '65%', dark: false },
    { width: '50%', dark: false },
    { width: '75%', dark: false },
  ],
  2: [
    { width: '55%', dark: false },
    { width: '40%', dark: false },
    { width: '70%', dark: false },
  ],
};

interface FormSelectScreenProps {
  onNext?: () => void;
  onPrev?: () => void;
}

export default function FormSelectScreen({ onNext, onPrev }: FormSelectScreenProps) {
  const [forms, setForms] = useState<AvailableForm[]>([]);
  const [selectedIdx, setSelectedIdx] = useState(0);

  useEffect(() => {
    const raw = sessionStorage.getItem('availableForms');
    if (raw) {
      try {
        const parsed: AvailableForm[] = JSON.parse(raw);
        if (parsed.length > 0) {
          setForms(parsed.slice(0, 3));
          return;
        }
      } catch { /* fall through to mock */ }
    }
    setForms(MOCK_FORMS);
  }, []);

  function handleConfirm() {
    const selected = forms[selectedIdx];
    if (selected) {
      sessionStorage.setItem('formId', String(selected.formId));
      sessionStorage.setItem('formName', selected.formName);
    }
    onNext?.();
  }

  return (
    <div style={{ fontFamily: 'var(--font-ui)', background: '#E8ECF2', minHeight: '100vh' }}>
      <div style={{ padding: '28px 32px' }}>
        {/* AI strip */}
        <div style={{
          background: '#1C2B4A', borderRadius: 10,
          padding: '14px 18px', display: 'flex', alignItems: 'center', gap: 12,
          marginBottom: 22,
        }}>
          <div style={{
            width: 32, height: 32, borderRadius: '50%',
            background: 'rgba(255,255,255,0.12)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: 12, fontWeight: 700, color: '#fff', flexShrink: 0,
          }}>AI</div>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 13, fontWeight: 700, color: '#fff', marginBottom: 2 }}>증빙자료 분석 완료</div>
            <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.6)' }}>영수증 감지 · 지출 카테고리로 분류됨</div>
          </div>
          <span style={{
            display: 'inline-flex', alignItems: 'center', gap: 3,
            fontSize: 10, fontWeight: 700, padding: '2px 8px', borderRadius: 100,
            background: '#E8F5EE', color: '#3A8A5C',
          }}>추천 완료</span>
        </div>

        <div style={{ fontSize: 14, fontWeight: 700, color: '#1C2B4A', marginBottom: 16 }}>
          추천 양식지{' '}
          <span style={{ fontWeight: 400, color: '#8A96A8' }}>({forms.length}종)</span>
        </div>

        {/* Form cards */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 16, marginBottom: 24 }}>
          {forms.map((form, i) => {
            const rank = RANK_BADGES[i] ?? RANK_BADGES[2];
            const match = MATCH_BADGES[i] ?? MATCH_BADGES[2];
            const isSelected = selectedIdx === i;
            const lines = PREVIEW_LINES[i] ?? PREVIEW_LINES[2];
            return (
              <div
                key={form.formId}
                onClick={() => setSelectedIdx(i)}
                style={{
                  border: `2px solid ${isSelected ? '#1C2B4A' : '#E2E7EF'}`,
                  borderRadius: 12, padding: 16,
                  background: isSelected ? '#EAF0F8' : '#fff',
                  cursor: 'pointer', transition: 'all 0.15s',
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 9 }}>
                  <span style={{
                    display: 'inline-flex', alignItems: 'center',
                    fontSize: 10, fontWeight: 700, padding: '2px 8px', borderRadius: 100,
                    background: rank.bg, color: rank.color,
                  }}>{rank.label}</span>
                  <span style={{
                    display: 'inline-flex', alignItems: 'center',
                    fontSize: 10, fontWeight: 700, padding: '2px 8px', borderRadius: 100,
                    background: match.bg, color: match.color,
                  }}>{match.label}</span>
                </div>

                {/* Preview */}
                <div style={{
                  background: '#F4F6FA', borderRadius: 8, height: 90,
                  display: 'flex', flexDirection: 'column', alignItems: 'center',
                  justifyContent: 'center', gap: 5, marginBottom: 10,
                }}>
                  {lines.map((line, j) => (
                    <div key={j} style={{
                      height: 3, borderRadius: 2,
                      background: line.dark ? '#1C2B4A' : '#B8C2D0',
                      width: line.width,
                    }} />
                  ))}
                </div>

                <div style={{ fontSize: 13, fontWeight: 700, color: '#1C2B4A', marginBottom: 3 }}>{form.formName}</div>
                <div style={{ fontSize: 11, color: '#8A96A8' }}>{form.description || '지출결의서 양식'}</div>
              </div>
            );
          })}
        </div>

        <div style={{ display: 'flex', justifyContent: 'space-between' }}>
          <button
            onClick={onPrev}
            style={{
              display: 'inline-flex', alignItems: 'center',
              background: 'transparent', color: '#1C2B4A', border: '1.5px solid #1C2B4A',
              borderRadius: 6, padding: '9px 20px', fontSize: 13, fontWeight: 600,
              cursor: 'pointer', fontFamily: 'var(--font-ui)',
            }}
          >← 이전</button>
          <button
            onClick={handleConfirm}
            style={{
              display: 'inline-flex', alignItems: 'center',
              background: '#1C2B4A', color: '#fff', border: 'none',
              borderRadius: 6, padding: '11px 28px', fontSize: 14, fontWeight: 600,
              cursor: 'pointer', fontFamily: 'var(--font-ui)',
            }}
          >선택 완료 · 자동 입력 시작 →</button>
        </div>
      </div>
    </div>
  );
}
