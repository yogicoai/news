'use client';

import { useState } from 'react';
import styles from '../admin.module.css';

function fmtTime(v) {
  if (!v) return '-';
  return new Date(v).toLocaleString('ko-KR', { month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' });
}

export default function PipelineBanner({ status }) {
  const [open, setOpen] = useState(true);
  if (!status) return null;

  const r = status.lastRun?.result;
  const feedHost = status.feedUrl.replace(/^https?:\/\//, '').replace(/\.atom$/, '');

  return (
    <section className={styles.banner}>
      <div className={styles.bannerHead}>
        <div>
          <strong>📡 일본 요기보 공식 블로그({feedHost})</strong>
          {status.schedule === 'off'
            ? ' 자동 수집이 꺼져 있습니다(로컬). ‘지금 수집하기’로 직접 불러올 수 있습니다.'
            : `를 ${status.scheduleText.replace(' 자동 수집', '')} 자동으로 불러오고 있습니다.`}
        </div>
        <button className={styles.linkBtn} onClick={() => setOpen((v) => !v)}>{open ? '접기' : '자세히'}</button>
      </div>

      {open && (
        <div className={styles.bannerBody}>
          <ol className={styles.bannerSteps}>
            <li>
              <b>1차 필터</b> — {status.excludeRules.join(' · ')}은 자동으로 빼서 <em>제외됨</em>에 사유와 함께 둡니다.
            </li>
            <li>
              <b>재편집</b> — 통과한 새 글은 한국 독자용 v5 기사로 다시 쓰고, 일본 제품은 국내몰 같은 상품 페이지로 연결합니다(상품 카드·UTM 포함). 결과는 <em>검수대기</em>로.
            </li>
            <li>
              <b>발행</b> — 검수 포인트를 확인하고 사람이 발행 버튼을 눌러야 매거진에 올라갑니다.
            </li>
          </ol>
          <div className={styles.bannerStats}>
            <span>
              마지막 수집 {fmtTime(status.lastRun?.startedAt)}
              {r && ` · 신규 ${r.inserted} · 검수대기 ${r.pending} · 제외 ${r.excluded}${r.reprocessed ? ` · 재처리 ${r.reprocessed}` : ''}`}
            </span>
            {status.waiting > 0 && <span>Claude 분류 대기 {status.waiting}건</span>}
            <span>
              국내 판매 상품 {status.krCatalog.count}개 ({status.krCatalog.source === 'cafe24' ? 'Cafe24 실시간' : status.krCatalog.source === 'sitemap' ? 'sitemap 대체' : '조회 실패'})
            </span>
            {!status.claudeEnabled && <span className={styles.bannerWarn}>로컬 모드: Claude 꺼짐 — 수집만 되고 분류·재편집은 라이브 서버에서 진행</span>}
          </div>
        </div>
      )}
    </section>
  );
}
