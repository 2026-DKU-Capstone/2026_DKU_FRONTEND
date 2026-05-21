'use client';

import React, { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Badge } from '@/components/ui';
import { apiFetch } from '@/lib/api';
import { getGroupId } from '@/lib/group';
import { getUserInfo } from '@/lib/auth';

interface MonthFile {
  name: string;
  date: string;
  status: 'ok' | 'warn' | 'err';
}

interface MonthData {
  year: number;
  month: number;
  open: boolean;
  files: MonthFile[];
}

interface Submission {
  requestId?: number;
  id: string;
  title: string;
  date: string;
  status: 'review' | 'approved' | 'rejected';
}

interface SummaryData {
  monthlySubmitCount: number;
  prevMonthSubmitCount: number;
  monthlyTotalAmount: number;
  prevMonthTotalAmount: number;
  inProgressCount: number;
  avgWaitingDays: number;
  complianceRate: number;
}

interface DashboardScreenProps {
  onNew?: () => void;
}

type ApiStatus = 'IN_PROGRESS' | 'APPROVED' | 'REJECTED' | 'CANCELED';

function fileStatusOf(s: ApiStatus): MonthFile['status'] {
  if (s === 'APPROVED') return 'ok';
  if (s === 'REJECTED' || s === 'CANCELED') return 'err';
  return 'warn';
}

function submissionStatusOf(s: ApiStatus): Submission['status'] {
  if (s === 'APPROVED') return 'approved';
  if (s === 'REJECTED' || s === 'CANCELED') return 'rejected';
  return 'review';
}

const MOCK_MONTHS: MonthData[] = [
  {
    year: 2025, month: 1, open: true,
    files: [
      { name: '출장비_결의서_0117.pdf', date: '01-17', status: 'err' },
      { name: '법인카드_사용명세_0110.pdf', date: '01-10', status: 'ok' },
      { name: '물품구매_결의서_0105.pdf', date: '01-05', status: 'ok' },
    ],
  },
  {
    year: 2024, month: 12, open: false,
    files: [
      { name: '출장비_결의서_1220.pdf', date: '12-20', status: 'ok' },
      { name: '접대비_결의서_1215.pdf', date: '12-15', status: 'warn' },
      { name: '소모품_구매_결의서_1208.pdf', date: '12-08', status: 'ok' },
      { name: '출장비_결의서_1201.pdf', date: '12-01', status: 'ok' },
    ],
  },
  {
    year: 2024, month: 11, open: false,
    files: [
      { name: '출장비_결의서_1118.pdf', date: '11-18', status: 'ok' },
      { name: '법인카드_사용명세_1105.pdf', date: '11-05', status: 'ok' },
    ],
  },
];

const MOCK_SUBMISSIONS: Submission[] = [
  { id: 'EXP-2025-0142', title: '출장비 지출결의서', date: '2025-01-17', status: 'review' },
  { id: 'EXP-2025-0131', title: '법인카드 사용명세서', date: '2025-01-10', status: 'approved' },
  { id: 'EXP-2025-0118', title: '물품구매 결의서', date: '2025-01-05', status: 'approved' },
  { id: 'EXP-2024-0412', title: '접대비 지출결의서', date: '2024-12-15', status: 'rejected' },
  { id: 'EXP-2024-0398', title: '출장비 지출결의서', date: '2024-12-01', status: 'approved' },
];

const STATUS_COLORS: Record<MonthFile['status'], string> = {
  ok: 'var(--green)', warn: 'var(--amber)', err: 'var(--red)',
};

const STATUS_BG: Record<MonthFile['status'], string> = {
  ok: 'var(--green-bg)', warn: 'var(--amber-bg)', err: 'var(--red-bg)',
};

const FileIcon = ({ color = 'var(--blue)' }: { color?: string }) => (
  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="1.5" strokeLinecap="round">
    <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z" />
    <polyline points="14 2 14 8 20 8" />
  </svg>
);

function DirMonth({ year, month, open: initOpen, files }: MonthData) {
  const [open, setOpen] = useState(initOpen);

  return (
    <>
      <div
        onClick={() => setOpen(o => !o)}
        style={{
          border: '1px solid var(--gray2)', borderRadius: 8,
          padding: '10px 14px', marginBottom: 6,
          display: 'flex', alignItems: 'center', cursor: 'pointer',
          background: open ? 'var(--blue-pale)' : '#fff',
          borderColor: open ? '#C8D6E8' : 'var(--gray2)',
        }}
      >
        <span style={{ marginRight: 8, color: 'var(--gray4)', fontSize: 13 }}>📁</span>
        <span style={{ flex: 1, fontSize: 13, fontWeight: 600, color: 'var(--navy)' }}>
          {year}년 {month}월
        </span>
        <span style={{ fontSize: 11, color: 'var(--gray4)', marginRight: 8 }}>{files.length}건</span>
        <span style={{
          fontSize: 9, color: 'var(--gray4)',
          transform: open ? 'rotate(0deg)' : 'rotate(0deg)',
        }}>{open ? '▴' : '▾'}</span>
      </div>

      {open && files.map((f, i) => (
        <div key={i}
          style={{
            display: 'flex', alignItems: 'center',
            padding: '8px 14px 8px 38px', cursor: 'pointer',
            borderRadius: 6, fontSize: 12,
          }}
          onMouseEnter={e => (e.currentTarget.style.background = 'var(--gray1)')}
          onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
        >
          <FileIcon color="#E36464" />
          <span style={{ flex: 1, marginLeft: 8, color: 'var(--navy)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {f.name}
          </span>
          <span style={{ fontSize: 10, color: 'var(--gray4)', fontFamily: 'var(--font-mono)', marginRight: 8, flexShrink: 0 }}>
            {f.date}
          </span>
          <span style={{
            fontSize: 9, fontWeight: 700, padding: '2px 6px', borderRadius: 3, flexShrink: 0,
            background: STATUS_BG[f.status], color: STATUS_COLORS[f.status],
          }}>
            {f.status === 'ok' ? '통과' : f.status === 'warn' ? '주의' : '위반'}
          </span>
        </div>
      ))}
    </>
  );
}

export default function DashboardScreen({ onNew }: DashboardScreenProps) {
  const router = useRouter();
  const userName = getUserInfo()?.name ?? '';
  const dashRef = useRef<HTMLDivElement>(null);
  const [revealed, setRevealed] = useState(false);

  const [summary, setSummary] = useState<SummaryData | null>(null);
  const [months, setMonths] = useState<MonthData[]>(MOCK_MONTHS);
  const [submissions, setSubmissions] = useState<Submission[]>(MOCK_SUBMISSIONS);
  const [counts, setCounts] = useState<{ review: number; approved: number; rejected: number }>({ review: 1, approved: 3, rejected: 1 });
  const [hasPolicies, setHasPolicies] = useState(false);

  useEffect(() => {
    const el = dashRef.current;
    if (!el) return;
    const obs = new IntersectionObserver(([e]) => {
      if (e.isIntersecting) { setRevealed(true); obs.disconnect(); }
    }, { threshold: 0.08 });
    obs.observe(el);
    return () => obs.disconnect();
  }, []);

  useEffect(() => {
    const groupId = getGroupId();
    if (!groupId) return;
    const q = `?groupId=${groupId}`;

    apiFetch(`/api/dashboard/summary${q}`)
      .then(r => r.ok ? r.json() : null)
      .then((data: SummaryData | null) => { if (data) setSummary(data); })
      .catch(() => { /* 모킹 폴백 유지 */ });

    apiFetch(`/api/policies${q}`)
      .then(r => r.ok ? r.json() : null)
      .then((data: unknown[] | null) => { if (data) setHasPolicies(data.length > 0); })
      .catch(() => { /* 폴백 유지 */ });

    apiFetch(`/api/dashboard/monthly-directory${q}`)
      .then(r => r.ok ? r.json() : null)
      .then((data: { year: number; month: number; count: number; files: { requestId: number; fileName: string; date: string; status: ApiStatus }[] }[] | null) => {
        if (!data) return;
        const mapped: MonthData[] = data.map((m, i) => ({
          year: m.year, month: m.month, open: i === 0,
          files: m.files.map(f => ({
            name: f.fileName,
            date: f.date.slice(5),
            status: fileStatusOf(f.status),
          })),
        }));
        setMonths(mapped);
      })
      .catch(() => { /* 모킹 폴백 유지 */ });

    apiFetch(`/api/dashboard/recent-approvals${q}`)
      .then(r => r.ok ? r.json() : null)
      .then((data: { reviewingCount: number; approvedCount: number; rejectedCount: number; items: { requestId: number; title: string; expCode: string; date: string; requesterName: string; status: ApiStatus }[] } | null) => {
        if (!data) return;
        setCounts({
          review: data.reviewingCount,
          approved: data.approvedCount,
          rejected: data.rejectedCount,
        });
        setSubmissions(data.items.map(i => ({
          requestId: i.requestId,
          id: i.expCode,
          title: i.title,
          date: i.date,
          status: submissionStatusOf(i.status),
        })));
      })
      .catch(() => { /* 모킹 폴백 유지 */ });
  }, []);

  const QUICK = [
    { title: '규정책 업로드', badge: hasPolicies ? '✓' : '!', badgeBg: hasPolicies ? 'var(--green)' : 'var(--red)', route: '/regulation',
      icon: (
        <svg width="22" height="22" viewBox="0 0 24 24" fill="none">
          <rect x="5" y="3" width="14" height="18" rx="2" stroke="var(--navy)" strokeWidth="1.5" />
          <path d="M9 8h6M9 12h6M9 16h4" stroke="var(--navy)" strokeWidth="1.5" strokeLinecap="round" />
        </svg>
      ),
    },
    { title: '지출결의 생성', badge: '✓', badgeBg: 'var(--green)', route: '/receipt',
      icon: (
        <svg width="22" height="22" viewBox="0 0 24 24" fill="none">
          <rect x="4" y="4" width="16" height="16" rx="2" stroke="var(--navy)" strokeWidth="1.5" />
          <path d="M8 12l3 3 5-6" stroke="var(--navy)" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      ),
    },
    { title: '이용내역 조회', badge: 'i', badgeBg: 'var(--blue)', route: '/expense-board',
      icon: (
        <svg width="22" height="22" viewBox="0 0 24 24" fill="none">
          <rect x="5" y="3" width="14" height="18" rx="2" stroke="var(--navy)" strokeWidth="1.5" />
          <path d="M9 9h6M9 13h6M9 17h3" stroke="var(--navy)" strokeWidth="1.5" strokeLinecap="round" />
        </svg>
      ),
    },
    { title: '내정보 변경', badge: '+', badgeBg: 'var(--green)', route: '/group-select',
      icon: (
        <svg width="22" height="22" viewBox="0 0 24 24" fill="none">
          <circle cx="12" cy="9" r="3" stroke="var(--navy)" strokeWidth="1.5" />
          <path d="M5 20c0-3.5 3-6 7-6s7 2.5 7 6" stroke="var(--navy)" strokeWidth="1.5" strokeLinecap="round" />
        </svg>
      ),
    },
  ];

  return (
    <div style={{ fontFamily: 'var(--font-ui)', color: 'var(--navy)' }}>
      {/* HERO 마케팅 */}
      <section style={{
        position: 'relative', height: 520, overflow: 'hidden',
        background: 'linear-gradient(135deg,#EEF1F6 0%,#D8DEE8 60%,#C8D2E0 100%)',
      }}>
        <div style={{
          position: 'absolute', top: 0, right: '38%',
          width: '55%', height: '140%',
          background: 'linear-gradient(135deg,rgba(255,255,255,.55) 0%,rgba(255,255,255,0) 60%)',
          transform: 'skewX(-14deg)', transformOrigin: 'top', pointerEvents: 'none',
        }} />
        <button
          aria-label="이전"
          style={{
            position: 'absolute', top: '50%', left: 18, transform: 'translateY(-50%)',
            width: 32, height: 32, borderRadius: '50%',
            border: '1px solid var(--gray3)', background: 'rgba(255,255,255,.5)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            cursor: 'pointer', color: 'var(--gray5)', fontSize: 14,
          }}
        >‹</button>
        <button
          aria-label="다음"
          style={{
            position: 'absolute', top: '50%', right: 18, transform: 'translateY(-50%)',
            width: 32, height: 32, borderRadius: '50%',
            border: '1px solid var(--gray3)', background: 'rgba(255,255,255,.5)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            cursor: 'pointer', color: 'var(--gray5)', fontSize: 14,
          }}
        >›</button>
        <div style={{ padding: '64px 60px 0', position: 'relative', zIndex: 2, maxWidth: 1200 }}>
          <div style={{
            display: 'inline-flex', background: '#fff',
            fontSize: 11, fontWeight: 700, letterSpacing: '1.6px',
            color: 'var(--navy)', padding: '5px 12px',
            borderRadius: 5, marginBottom: 18,
          }}>EVENT</div>
          <h1 style={{
            fontSize: 40, fontWeight: 900, lineHeight: 1.18,
            color: 'var(--navy)', letterSpacing: '-0.6px', marginBottom: 18,
          }}>
            AI 기반 지출결의의<br />자동화의 정석, 가결
          </h1>
          <p style={{ fontSize: 13, color: 'var(--gray5)', lineHeight: 1.85, marginBottom: 32 }}>
            복잡한 기업 지출 증빙과 규정 준수 확인,<br />
            이제 AI가 실시간으로 분석하고 자동으로 처리합니다.
          </p>
          <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
            <button style={{
              padding: '10px 24px', borderRadius: 100,
              fontSize: 13, fontWeight: 700, cursor: 'pointer',
              border: '1px solid var(--gray2)', background: '#fff',
              color: 'var(--navy)', fontFamily: 'inherit',
            }}>자세히보기 ›</button>
            <button
              onClick={onNew}
              style={{
                padding: '10px 24px', borderRadius: 100,
                fontSize: 13, fontWeight: 700, cursor: 'pointer',
                background: 'var(--navy)', color: '#fff',
                border: '1px solid var(--navy)', fontFamily: 'inherit',
              }}>이벤트 전체보기 ›</button>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 18 }}>
            <div style={{ fontSize: 11, color: 'var(--gray5)', marginRight: 6 }}>II</div>
            {[0, 1, 2, 3, 4, 5, 6].map(i => (
              <div key={i} style={{
                width: i === 3 ? 18 : 6, height: 6,
                borderRadius: i === 3 ? 6 : '50%',
                background: i === 3 ? 'var(--navy)' : 'var(--gray3)',
              }} />
            ))}
            <span style={{
              fontSize: 11, color: 'var(--gray5)', marginLeft: 10,
              fontFamily: 'var(--font-mono)',
            }}>6 / 12</span>
          </div>
        </div>
      </section>

      {/* QUICK MENU */}
      <section style={{
        background: '#fff',
        display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)',
        borderBottom: '1px solid var(--gray2)',
      }}>
        {QUICK.map((q, i) => (
          <div
            key={q.title}
            onClick={() => router.push(q.route)}
            style={{
              padding: '30px 18px', textAlign: 'center', cursor: 'pointer',
              borderRight: i < QUICK.length - 1 ? '1px solid var(--gray2)' : 'none',
              transition: 'background 0.15s',
            }}
            onMouseEnter={e => (e.currentTarget.style.background = 'var(--gray1)')}
            onMouseLeave={e => (e.currentTarget.style.background = '#fff')}
          >
            <div style={{
              width: 44, height: 46, margin: '0 auto 10px',
              background: '#fff', border: '1px solid var(--gray2)', borderRadius: 7,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              position: 'relative',
            }}>
              {q.icon}
              <span style={{
                position: 'absolute', top: -4, right: -4,
                width: 14, height: 14, borderRadius: '50%',
                background: q.badgeBg, color: '#fff',
                fontSize: 8, fontWeight: 700,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
              }}>{q.badge}</span>
            </div>
            <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--navy)' }}>{q.title}</div>
          </div>
        ))}
      </section>

      {/* SCROLL HINT */}
      <div style={{ display: 'flex', justifyContent: 'center', padding: '14px 0', background: 'var(--bg)' }}>
        <div style={{
          width: 18, height: 28,
          border: '1.5px solid var(--gray4)', borderRadius: 10,
          position: 'relative', animation: 'bob 1.6s ease-in-out infinite',
        }}>
          <div style={{
            position: 'absolute', left: '50%', top: 6,
            width: 2, height: 6, background: 'var(--gray4)',
            borderRadius: 1, transform: 'translateX(-50%)',
          }} />
        </div>
      </div>

      {/* DASHBOARD */}
      <section
        ref={dashRef}
        style={{
          padding: '34px 38px 60px',
          opacity: revealed ? 1 : 0,
          transform: revealed ? 'translateY(0)' : 'translateY(60px)',
          transition: 'opacity 0.8s ease, transform 0.8s ease',
        }}
      >
        {/* dash-head */}
        <div style={{
          display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between',
          marginBottom: 24, padding: '24px 28px',
          background: 'linear-gradient(135deg,#F4F6FA 0%,#E8ECF2 100%)',
          borderRadius: 14, position: 'relative', overflow: 'hidden',
        }}>
          <div style={{
            content: '""', position: 'absolute', right: -40, top: -40,
            width: 200, height: 200, borderRadius: '50%',
            background: 'radial-gradient(circle, rgba(74,111,165,.10) 0%, transparent 70%)',
          }} />
          <div style={{ position: 'relative', zIndex: 1 }}>
            <span style={{
              display: 'inline-block', fontSize: 11, color: 'var(--gray4)',
              background: '#fff', padding: '3px 10px', borderRadius: 4, marginBottom: 10,
            }}>대시보드</span>
            <div style={{ fontSize: 24, fontWeight: 800, color: 'var(--navy)', marginBottom: 4 }}>
              안녕하세요, {userName}님
            </div>
            <div style={{ fontSize: 13, color: 'var(--gray5)' }}>
              {new Date().getFullYear()}년 {new Date().getMonth() + 1}월의 지출결의 현황을 확인하세요.
            </div>
          </div>
          <button
            onClick={onNew}
            style={{
              background: 'var(--navy)', color: '#fff', border: 'none',
              borderRadius: 7, padding: '11px 18px',
              fontSize: 13, fontWeight: 700, cursor: 'pointer',
              fontFamily: 'inherit', position: 'relative', zIndex: 1,
            }}
          >+ 새 결의서 작성</button>
        </div>

        {/* KPI grid */}
        <div style={{
          display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 14, marginBottom: 18,
        }}>
          {(() => {
            if (summary) {
              const diff = summary.monthlySubmitCount - summary.prevMonthSubmitCount;
              return [
                {
                  label: '이번 달 제출 건수',
                  value: `${summary.monthlySubmitCount}건`,
                  foot: `전월 대비 ${diff >= 0 ? '+' : ''}${diff}건`,
                },
                {
                  label: '이번 달 총 금액',
                  value: `${summary.monthlyTotalAmount.toLocaleString()}원`,
                  foot: `전월 ${summary.prevMonthTotalAmount.toLocaleString()}원`,
                },
                {
                  label: '처리 중',
                  value: `${summary.inProgressCount}건`,
                  foot: `평균 대기 ${summary.avgWaitingDays}일`,
                  color: 'var(--amber)',
                },
                {
                  label: '규정 준수율 평균',
                  value: `${summary.complianceRate}%`,
                  foot: '통과 기준 80% 이상',
                  color: 'var(--green)',
                },
              ];
            }
            return [
              { label: '이번 달 제출 건수', value: '12건', foot: '전월 대비 +3건' },
              { label: '이번 달 총 금액', value: '4,250,000원', foot: '전월 3,980,000원' },
              { label: '처리 중', value: '3건', foot: '평균 대기 2.4일', color: 'var(--amber)' },
              { label: '규정 준수율 평균', value: '84%', foot: '통과 기준 80% 이상', color: 'var(--green)' },
            ];
          })().map(k => (
            <div key={k.label} style={{
              background: '#fff', border: '1px solid var(--gray2)',
              borderRadius: 12, padding: '18px 20px',
            }}>
              <div style={{
                display: 'flex', justifyContent: 'space-between',
                alignItems: 'flex-start', marginBottom: 10,
              }}>
                <span style={{ fontSize: 12, color: 'var(--gray5)' }}>{k.label}</span>
                <div style={{
                  width: 30, height: 30, borderRadius: 8,
                  background: 'var(--gray1)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  color: 'var(--gray4)',
                }}>
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                    <circle cx="12" cy="12" r="9" />
                  </svg>
                </div>
              </div>
              <div style={{
                fontFamily: 'var(--font-mono)', fontSize: 30, fontWeight: 800,
                color: k.color ?? 'var(--navy)', letterSpacing: '-0.5px',
              }}>{k.value}</div>
              <div style={{ fontSize: 11, color: 'var(--gray4)', marginTop: 8 }}>{k.foot}</div>
            </div>
          ))}
        </div>

        {/* 2 COL */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
          {/* 월별 디렉토리 */}
          <div style={{
            background: '#fff', border: '1px solid var(--gray2)',
            borderRadius: 12, padding: '18px 20px',
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 14 }}>
              <div>
                <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--navy)' }}>월별 결의서 디렉토리</div>
                <div style={{ fontSize: 11, color: 'var(--gray4)', marginTop: 2 }}>연도·월 단위로 분류된 제출 파일</div>
              </div>
              <span style={{ fontSize: 11, color: 'var(--red)', cursor: 'pointer', fontWeight: 600 }}>전체 보기 ›</span>
            </div>
            <div style={{ position: 'relative', marginBottom: 10 }}>
              <span style={{
                position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)',
                color: 'var(--gray4)', fontSize: 14,
              }}>⌕</span>
              <input
                placeholder="파일명 검색..."
                style={{
                  width: '100%', border: '1px solid var(--gray2)', borderRadius: 7,
                  padding: '9px 12px 9px 30px', fontSize: 12, fontFamily: 'inherit',
                  color: 'var(--navy)', background: '#fff', outline: 'none',
                }}
              />
            </div>
            {months.map(m => <DirMonth key={`${m.year}-${m.month}`} {...m} />)}
          </div>

          {/* 결의서 상태 추적 */}
          <div style={{
            background: '#fff', border: '1px solid var(--gray2)',
            borderRadius: 12, padding: '18px 20px',
            display: 'flex', flexDirection: 'column',
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 14 }}>
              <div>
                <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--navy)' }}>결의서 상태 추적</div>
                <div style={{ fontSize: 11, color: 'var(--gray4)', marginTop: 2 }}>최근 5건의 제출 현황</div>
              </div>
              <span
                onClick={() => router.push('/approvals')}
                style={{ fontSize: 11, color: 'var(--red)', cursor: 'pointer', fontWeight: 600 }}
              >전체 보기 ›</span>
            </div>

            <div style={{ display: 'flex', gap: 8, marginBottom: 12 }}>
              {[
                { label: '검토중', count: counts.review,   variant: 'warn' as const },
                { label: '승인',   count: counts.approved, variant: 'ok'   as const },
                { label: '반려',   count: counts.rejected, variant: 'err'  as const },
              ].map(t => (
                <span key={t.label} style={{
                  display: 'inline-flex', alignItems: 'center', gap: 5,
                  fontSize: 11, padding: '4px 12px', borderRadius: 100,
                  background: 'var(--gray1)', color: 'var(--gray5)', fontWeight: 600,
                }}>
                  {t.label}
                  <Badge variant={t.variant}>{t.count}</Badge>
                </span>
              ))}
            </div>

            <div style={{ flex: 1 }}>
              {submissions.map(s => {
                const cfg = s.status === 'approved'
                  ? { bg: '#F4FAF6', border: '#D5EAD9', icoBg: '#fff', icoColor: 'var(--green)', stat: '승인', statBg: 'var(--green-bg)', statColor: 'var(--green)', icon: '✓' }
                  : s.status === 'rejected'
                  ? { bg: '#FEF6F5', border: '#F0D2CC', icoBg: '#fff', icoColor: 'var(--red)', stat: '반려', statBg: 'var(--red-bg)', statColor: 'var(--red)', icon: '✕' }
                  : { bg: '#FFFCF5', border: '#F4E5C5', icoBg: '#fff', icoColor: 'var(--amber)', stat: '검토중', statBg: 'var(--amber-bg)', statColor: 'var(--amber)', icon: '⏱' };
                return (
                  <div
                    key={s.id}
                    onClick={() => { if (s.requestId != null) router.push(`/approvals/${s.requestId}`); }}
                    style={{
                      display: 'flex', alignItems: 'center',
                      background: cfg.bg, border: `1px solid ${cfg.border}`,
                      borderRadius: 9, padding: '11px 13px', marginBottom: 7, gap: 12,
                      cursor: s.requestId != null ? 'pointer' : 'default',
                    }}>
                    <div style={{
                      width: 32, height: 32, borderRadius: '50%',
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      fontSize: 13, fontWeight: 700, flexShrink: 0,
                      background: cfg.icoBg, color: cfg.icoColor,
                    }}>{cfg.icon}</div>
                    <div style={{ flex: 1 }}>
                      <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--navy)' }}>{s.title}</div>
                      <div style={{ fontSize: 10, color: 'var(--gray4)', fontFamily: 'var(--font-mono)', marginTop: 2 }}>
                        {s.id} · {s.date}
                      </div>
                    </div>
                    <span style={{
                      fontSize: 10, fontWeight: 700, padding: '3px 9px', borderRadius: 100,
                      background: cfg.statBg, color: cfg.statColor,
                    }}>{cfg.stat}</span>
                  </div>
                );
              })}
            </div>

            <button
              onClick={onNew}
              style={{
                marginTop: 10, width: '100%',
                border: '1px solid var(--gray3)', background: '#fff',
                borderRadius: 8, padding: 13, fontSize: 13, fontWeight: 700,
                color: 'var(--navy)', cursor: 'pointer', fontFamily: 'inherit',
              }}
            >+ 새 결의서 시작하기</button>
          </div>
        </div>
      </section>

      {/* FAB */}
      <div style={{
        position: 'fixed', right: 30, bottom: 30,
        display: 'flex', flexDirection: 'column', gap: 10, zIndex: 50,
      }}>
        <button style={{
          width: 42, height: 42, borderRadius: '50%', background: 'var(--navy)',
          color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center',
          cursor: 'pointer', fontSize: 16, border: 'none',
          boxShadow: '0 8px 18px rgba(28,43,74,.25)',
        }}>+</button>
        <button style={{
          width: 42, height: 42, borderRadius: '50%', background: 'var(--blue)',
          color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center',
          cursor: 'pointer', fontSize: 16, border: 'none',
          boxShadow: '0 8px 18px rgba(28,43,74,.25)',
        }}>✉</button>
      </div>

      <style>{`
        @keyframes bob {
          0%, 100% { transform: translateY(0); }
          50% { transform: translateY(4px); }
        }
      `}</style>
    </div>
  );
}
