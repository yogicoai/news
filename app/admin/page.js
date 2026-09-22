'use client';

import { useCallback, useEffect, useState } from 'react';
import { api, API_BASE } from './api';
import MagazinePreview from './components/MagazinePreview';
import AiWriteModal from './components/AiWriteModal';
import BrandKnowledgeModal from './components/BrandKnowledgeModal';
import PipelineBanner from './components/PipelineBanner';
import styles from './admin.module.css';

// 원본 → 검수대기 → 라이브 순서로 넘어가는 흐름. 제외됨·전체는 흐름 밖 보조 탭
const FLOW_TABS = [
  { key: 'draft', label: '원본', hint: 'AI 편집 전 원본 · 분류 대기 · 재편집할 분량이 부족한 글 · 직접 작성/AI 작성 초안' },
  { key: 'pending', label: '검수대기', hint: 'AI 편집 완료 — 내용과 검수 포인트를 확인하고 발행 여부를 판단하세요' },
  { key: 'published', label: '라이브', hint: '매거진에 게시 중 · 드래그로 노출 순서 변경' },
];
const SIDE_TABS = [
  { key: 'excluded', label: '제외됨', hint: '자동 제외(지역 행사·매장 공지·국내 미판매·일본 한정 콜라보·기간 한정) + 검수자가 발행 안 함으로 판단한 글' },
  { key: 'all', label: '전체', hint: '보관된 예전 원본을 뺀 전체' },
];
const TABS = [...FLOW_TABS, ...SIDE_TABS];

const STATUS_LABEL = { draft: '원본', pending: '검수대기', published: '라이브', excluded: '제외됨' };

const EXCLUDE_LABEL = {
  local_event: '일본 지역 행사',
  store_notice: '일본 매장·공지',
  jp_only_product: '국내 미판매 제품',
  jp_collab: '일본 한정 콜라보',
  period_limited: '기간 한정 행사·캠페인',
  reviewer: '검수자 판단 · 발행 안 함',
  other: '기타 · 본문 없음·게시 부적합',
};

const MANUAL_TEMPLATE = `<div style="font-family: 'Pretendard', -apple-system, BlinkMacSystemFont, sans-serif;">
<div style="padding: 36px 32px 20px;">
<h1 style="font-size: 24px; font-weight: 900; color: #1e3a47; line-height: 1.45; margin: 0;">제목을 입력하세요</h1>
</div>
<div style="padding: 0 32px 28px;">
<p style="margin: 0 0 20px;">본문을 입력하세요.</p>
</div>
</div>`;

function fmtDate(v) {
  if (!v) return '-';
  const d = new Date(v);
  if (Number.isNaN(d.getTime())) return '-';
  return d.toLocaleDateString('ko-KR', { year: 'numeric', month: '2-digit', day: '2-digit' });
}

function cardHint(item) {
  const p = item.pipeline || {};
  if (item.status === 'excluded') return `🚫 ${EXCLUDE_LABEL[p.excludeCategory] || '제외'} · ${p.excludeReason || ''}`;
  if (p.error) return '⚠️ 자동 재편집 실패 · 수동 확인';
  if (p.skipped) return '⏳ Claude 분류 대기 (라이브 서버에서 처리)';
  if (item.status === 'pending' && p.reviewNotes?.length) return `📝 검수 포인트 ${p.reviewNotes.length}개`;
  if (item.status === 'draft' && p.classifiedAt && !p.exclude && p.translatable) return '✅ 제외 기준 통과 · AI 편집 가능';
  if (item.status === 'draft' && p.classifiedAt && !p.translatable) return `✋ ${p.translatableReason || '본문 부족 · 수동 확인'}`;
  return null;
}

export default function AdminPage() {
  const [tab, setTab] = useState('pending');
  const [items, setItems] = useState([]);
  const [counts, setCounts] = useState({});
  const [loading, setLoading] = useState(false);
  const [selectedId, setSelectedId] = useState(null);
  const [editTitle, setEditTitle] = useState('');
  const [editContent, setEditContent] = useState('');
  const [showOriginal, setShowOriginal] = useState(false);
  const [viewMode, setViewMode] = useState('preview');
  const [message, setMessage] = useState(null);
  const [busy, setBusy] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [modal, setModal] = useState(null);
  const [dragId, setDragId] = useState(null);
  const [showArchived, setShowArchived] = useState(false);
  const [pipelineStatus, setPipelineStatus] = useState(null);

  const selected = items.find((it) => it._id === selectedId) || null;
  const dirty = Boolean(selected) && (editTitle !== (selected.title || '') || editContent !== (selected.content || ''));
  const viewingArchive = tab === 'draft' && showArchived;

  const loadList = useCallback(
    async (targetTab) => {
      setLoading(true);
      try {
        const res = await api.list(targetTab, { limit: 200, archived: targetTab === 'draft' && showArchived });
        setItems(res.data || []);
        setCounts(res.counts || {});
        return res.data || [];
      } catch (err) {
        setMessage({ type: 'error', text: err.message });
        return [];
      } finally {
        setLoading(false);
      }
    },
    [showArchived]
  );

  const loadStatus = useCallback(async () => {
    try {
      setPipelineStatus((await api.pipelineStatus()).data);
    } catch {
      setPipelineStatus(null);
    }
  }, []);

  useEffect(() => {
    loadStatus();
  }, [loadStatus]);

  useEffect(() => {
    loadList(tab);
    setSelectedId(null);
  }, [tab, loadList]);

  function fillEditor(item) {
    setEditTitle(item?.title || '');
    setEditContent(item?.content || '');
  }

  function notify(type, text) {
    setMessage({ type, text });
    if (type === 'success') setTimeout(() => setMessage(null), 4000);
  }

  function confirmDiscard() {
    return !dirty || confirm('저장하지 않은 수정 내용이 있습니다. 버리고 이동할까요?');
  }

  function selectItem(item) {
    if (item._id === selectedId || !confirmDiscard()) return;
    setSelectedId(item._id);
    fillEditor(item);
    setShowOriginal(false);
  }

  function changeTab(key) {
    if (key === tab || !confirmDiscard()) return;
    setTab(key);
  }

  // 목록을 다시 불러온 뒤 선택 글의 편집 내용을 서버 값으로 맞춘다
  async function refresh(targetTab = tab, keepId = selectedId) {
    const list = await loadList(targetTab);
    const item = list.find((it) => it._id === keepId);
    if (item) {
      setSelectedId(item._id);
      fillEditor(item);
    } else {
      setSelectedId(null);
    }
  }

  async function run(action, successText) {
    setBusy(true);
    try {
      await action();
      if (successText) notify('success', successText);
    } catch (err) {
      notify('error', err.message);
    } finally {
      setBusy(false);
    }
  }

  async function handleSync() {
    if (!confirmDiscard()) return;
    setSyncing(true);
    try {
      const r = (await api.runPipeline()).result || {};
      notify(
        'success',
        `수집 완료 — 신규 ${r.inserted ?? 0}건 · 검수대기 ${r.pending ?? 0} · 수동확인 ${r.needsReview ?? 0} · 제외 ${r.excluded ?? 0}` +
          (r.reprocessed ? ` · 재처리 ${r.reprocessed}` : '')
      );
      await Promise.all([refresh(), loadStatus()]);
    } catch (err) {
      notify('error', err.message);
    } finally {
      setSyncing(false);
    }
  }

  const handleSave = (extra = {}, successText = '저장되었습니다.') =>
    run(async () => {
      await api.update(selected._id, { title: editTitle, content: editContent, ...extra });
      const nextTab = extra.status && tab !== 'all' ? extra.status : tab;
      if (nextTab !== tab) setTab(nextTab);
      await refresh(nextTab, selected._id);
    }, successText);

  const handleStatus = (status, successText) =>
    run(async () => {
      await api.update(selected._id, { status });
      await refresh();
    }, successText);

  // 검수대기에서 발행하지 않기로 판단 → 사유와 함께 제외됨으로 (나중에 제외 취소로 검수대기에 되돌릴 수 있음)
  const handleReject = () =>
    run(async () => {
      const reason = prompt('발행하지 않는 이유를 적어주세요 (비워도 됩니다).', '');
      if (reason === null) return;
      await api.update(selected._id, { status: 'excluded', excludeReason: reason.trim() || '검수자가 발행하지 않기로 했습니다.' });
      await refresh();
    }, '발행 안 함으로 처리했습니다. 제외됨 탭에서 되돌릴 수 있습니다.');

  const handleConvert = () =>
    run(async () => {
      if (!confirm('Claude로 v5 매거진 기사로 재편집합니다. (건당 약 $0.3 과금) 진행할까요?')) return;
      await api.convert(selected._id);
      if (tab !== 'all' && tab !== 'pending') setTab('pending');
      await refresh(tab === 'all' ? 'all' : 'pending', selected._id);
      notify('success', '재편집이 끝났습니다. 검수 포인트를 확인하세요.');
    });

  const handleTranslate = () =>
    run(async () => {
      const res = await api.translate(selected.originalTitle || selected.title, selected.originalContent || selected.content);
      setEditTitle(res.translatedTitle || '');
      setEditContent(res.translatedContent || '');
    }, '구글 번역으로 초벌 번역했습니다. 확인 후 저장하세요.');

  const handleDelete = () =>
    run(async () => {
      if (!confirm('이 게시글을 삭제할까요? 되돌릴 수 없습니다.')) return;
      await api.remove(selected._id);
      setSelectedId(null);
      await loadList(tab);
    });

  const handleCreateManual = () =>
    run(async () => {
      if (!confirmDiscard()) return;
      const res = await api.create({ title: '새 게시글', content: MANUAL_TEMPLATE, status: 'draft' });
      setTab('draft');
      await refresh('draft', res.data._id);
      setViewMode('source');
    }, '새 게시글을 만들었습니다. HTML 소스에서 내용을 채워주세요.');

  async function handleAiCreated(post) {
    setModal(null);
    setTab('draft');
    await refresh('draft', post._id);
    notify('success', 'AI 초안을 저장했습니다. 검토 후 발행하세요.');
  }

  async function handleThumbnail(e) {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file || !selected) return;
    await run(async () => {
      await api.uploadThumbnail(selected._id, file);
      const list = await loadList(tab);
      const item = list.find((it) => it._id === selected._id);
      if (item && !dirty) fillEditor(item);
    }, '썸네일이 업로드되었습니다.');
  }

  async function handleDrop(targetId) {
    if (tab !== 'published' || !dragId || dragId === targetId) return;
    const next = [...items];
    const [moved] = next.splice(next.findIndex((i) => i._id === dragId), 1);
    next.splice(next.findIndex((i) => i._id === targetId), 0, moved);
    setItems(next);
    setDragId(null);
    await run(() => api.reorder(next.map((it, idx) => ({ id: it._id, position: (idx + 1) * 100 }))), '매거진 노출 순서를 저장했습니다.');
  }

  const p = selected?.pipeline || {};

  return (
    <div className={styles.wrap}>
      <header className={styles.header}>
        <div>
          <h1 className={styles.title}>요기보 뉴스레터 관리자</h1>
          <p className={styles.subtitle}>일본 블로그 수집 → 지역·미판매·일본 한정 필터링 → v5 재편집 → 검수 → 매거진 발행</p>
        </div>
        <div className={styles.headerActions}>
          <button className={styles.secondaryBtn} onClick={() => setModal('brand')}>브랜드자료</button>
          <button className={styles.secondaryBtn} onClick={handleCreateManual} disabled={busy}>직접 작성</button>
          <button className={styles.secondaryBtn} onClick={() => setModal('ai')}>AI 작성</button>
          <button className={styles.syncBtn} onClick={handleSync} disabled={syncing}>
            {syncing ? '수집 중…' : '지금 수집하기'}
          </button>
        </div>
      </header>

      <PipelineBanner status={pipelineStatus} />

      {message && (
        <div className={message.type === 'error' ? styles.msgError : styles.msgSuccess} onClick={() => setMessage(null)}>
          {message.text}
        </div>
      )}

      <div className={styles.tabs}>
        <div className={styles.flowTabs}>
          {FLOW_TABS.map((t, i) => (
            <div key={t.key} className={styles.flowStep}>
              {i > 0 && <span className={styles.flowArrow}>›</span>}
              <button className={tab === t.key ? styles.tabActive : styles.tab} onClick={() => changeTab(t.key)} title={t.hint}>
                {t.label} <span className={styles.count}>{counts[t.key] ?? '–'}</span>
              </button>
            </div>
          ))}
        </div>
        <div className={styles.sideTabs}>
          {SIDE_TABS.map((t) => (
            <button key={t.key} className={tab === t.key ? styles.tabActive : styles.tab} onClick={() => changeTab(t.key)} title={t.hint}>
              {t.label} <span className={styles.count}>{counts[t.key] ?? '–'}</span>
            </button>
          ))}
        </div>
      </div>
      <div className={styles.tabHintRow}>
        <p className={styles.tabHint}>
          {viewingArchive
            ? '2026년 이전에 쌓인 예전 원본입니다. 필터 도입 전 글이라 분류되지 않았습니다.'
            : TABS.find((t) => t.key === tab)?.hint}
        </p>
        {tab === 'draft' && counts.archived > 0 && (
          <label className={styles.archiveToggle}>
            <input
              type="checkbox"
              checked={showArchived}
              onChange={(e) => confirmDiscard() && setShowArchived(e.target.checked)}
            />
            보관된 예전 원본만 보기 ({counts.archived})
          </label>
        )}
      </div>

      <div className={styles.body}>
        <div className={styles.listPane}>
          {loading && <div className={styles.empty}>불러오는 중…</div>}
          {!loading && items.length === 0 && <div className={styles.empty}>게시글이 없습니다.</div>}
          {items.map((item) => {
            const hint = cardHint(item);
            return (
              <button
                key={item._id}
                className={`${item._id === selectedId ? styles.cardActive : styles.card} ${dragId === item._id ? styles.dragging : ''}`}
                onClick={() => selectItem(item)}
                draggable={tab === 'published'}
                onDragStart={() => setDragId(item._id)}
                onDragEnd={() => setDragId(null)}
                onDragOver={(e) => tab === 'published' && e.preventDefault()}
                onDrop={() => handleDrop(item._id)}
              >
                <div className={styles.cardTitle}>
                  {tab === 'published' && <span className={styles.dragHandle}>⋮⋮</span>}
                  {item.title || '(제목 없음)'}
                </div>
                <div className={styles.cardMeta}>
                  <span>{item.source === 'manual' ? '직접' : 'RSS'}</span>
                  {tab === 'all' && <span>{STATUS_LABEL[item.status] || item.status}</span>}
                  <span>{fmtDate(item.pubDate)}</span>
                </div>
                {hint && <div className={item.status === 'excluded' || item.pipeline?.error ? styles.reasonTag : styles.infoTag}>{hint}</div>}
              </button>
            );
          })}
        </div>

        <div className={styles.editorPane}>
          {!selected && <div className={styles.empty}>왼쪽에서 게시글을 선택하세요.</div>}
          {selected && (
            <>
              <div className={styles.editorHeader}>
                <div className={styles.badges}>
                  <span className={`${styles.statusBadge} ${styles['status_' + selected.status] || ''}`}>
                    {STATUS_LABEL[selected.status] || selected.status}
                  </span>
                  {selected.link && (
                    <a className={styles.sourceLink} href={selected.link} target="_blank" rel="noreferrer">일본 원문 ↗</a>
                  )}
                </div>
                <div className={styles.editorActions}>
                  {selected.status === 'excluded' &&
                    (p.convertedAt ? (
                      <button className={styles.secondaryBtn} onClick={() => handleStatus('pending', '검수대기로 되돌렸습니다.')} disabled={busy}>
                        검수대기로 되돌리기
                      </button>
                    ) : (
                      <button className={styles.secondaryBtn} onClick={() => handleStatus('draft', '제외를 취소했습니다. 원본 탭에서 재편집할 수 있습니다.')} disabled={busy}>
                        제외 취소
                      </button>
                    ))}
                  {(selected.status === 'draft' || selected.status === 'pending') && (
                    <button className={styles.secondaryBtn} onClick={handleConvert} disabled={busy}>
                      {selected.status === 'pending' ? 'AI 다시 재편집' : 'AI 재편집'}
                    </button>
                  )}
                  {selected.status === 'draft' && (
                    <button className={styles.secondaryBtn} onClick={handleTranslate} disabled={busy}>단순 번역</button>
                  )}
                  {selected.status === 'published' && (
                    <button className={styles.secondaryBtn} onClick={() => handleStatus('pending', '라이브에서 내렸습니다. 검수대기로 이동했습니다.')} disabled={busy}>
                      라이브 내리기
                    </button>
                  )}
                  <button className={styles.dangerBtn} onClick={handleDelete} disabled={busy}>삭제</button>
                </div>
              </div>

              {selected.status === 'excluded' && (
                <div className={styles.noticeBox}>
                  <strong>{EXCLUDE_LABEL[p.excludeCategory] || '자동 제외'}</strong>로 판별되어 발행 대상에서 뺐습니다.
                  <br />
                  사유: {p.excludeReason || '-'}
                </div>
              )}
              {p.error && <div className={styles.errorBox}>자동 재편집 실패: {p.error}</div>}
              {p.skipped && selected.status === 'draft' && (
                <div className={styles.infoBox}>
                  {p.backlog
                    ? '필터 도입 전에 쌓인 원본이라 아직 분류 전입니다. 라이브 서버가 수집할 때마다 30건씩 Claude로 분류하고(재편집은 하지 않음), 제외 대상은 제외됨으로 옮깁니다.'
                    : 'Claude가 꺼진 상태(로컬)에서 수집돼 아직 판별 전입니다. 라이브 서버의 다음 자동 수집 때 필터링·재편집이 진행됩니다.'}
                </div>
              )}
              {selected.status === 'draft' && p.classifiedAt && !p.exclude && p.translatable && !p.convertedAt && (
                <div className={styles.reviewBox}>
                  <div className={styles.reviewTitle}>제외 기준 통과</div>
                  제외 기준을 통과했습니다. <b>AI 재편집</b>을 누르면 v5 기사로 만들어 검수대기로 옮깁니다.
                </div>
              )}
              {selected.archived && (
                <div className={styles.infoBox}>보관된 예전 원본입니다. 상태를 바꾸거나 재편집하면 보관이 해제됩니다.</div>
              )}
              {selected.status !== 'excluded' && p.reviewNotes?.length > 0 && (
                <div className={styles.reviewBox}>
                  <div className={styles.reviewTitle}>검수 포인트</div>
                  <ul>
                    {p.reviewNotes.map((note, i) => (
                      <li key={i}>{note}</li>
                    ))}
                  </ul>
                </div>
              )}

              {selected.originalContent && selected.originalContent !== selected.content && (
                <>
                  <button className={styles.toggleOriginal} onClick={() => setShowOriginal((v) => !v)}>
                    {showOriginal ? '▲ 일본 원문 숨기기' : '▼ 일본 원문 보기'}
                  </button>
                  {showOriginal && (
                    <div className={styles.originalWrap}>
                      <div className={styles.originalTitle}>{selected.originalTitle}</div>
                      <MagazinePreview html={selected.originalContent} showHead={false} />
                    </div>
                  )}
                </>
              )}

              <label className={styles.label}>제목 (매거진 카드·팝업 제목)</label>
              <input className={styles.titleInput} value={editTitle} onChange={(e) => setEditTitle(e.target.value)} />

              <div className={styles.contentToolbar}>
                <label className={styles.label}>본문 {dirty && <span className={styles.dirtyMark}>· 수정됨</span>}</label>
                <div className={styles.viewToggle}>
                  {[
                    ['preview', '미리보기'],
                    ['edit', '✏️ 편집하기'],
                    ['source', 'HTML 소스'],
                  ].map(([key, label]) => (
                    <button key={key} className={viewMode === key ? styles.toggleActive : styles.toggle} onClick={() => setViewMode(key)}>
                      {label}
                    </button>
                  ))}
                </div>
              </div>

              {viewMode === 'preview' && (
                <>
                  <p className={styles.editHint}>매거진에 보일 모습 그대로입니다. 링크를 누르면 새 탭에서 열려 주소를 확인할 수 있어요.</p>
                  <MagazinePreview title={editTitle} html={editContent} mode="preview" />
                </>
              )}
              {viewMode === 'edit' && (
                <>
                  <p className={styles.editHintEdit}>
                    ✏️ 제목·본문 글자를 <b>더블클릭</b>해서 고치세요 (Enter·바깥 클릭 완료, Esc 취소). 링크를 <b>클릭</b>하면 주소를 확인·수정할 수 있어요. 다 고친 뒤 <b>저장</b>을 눌러야 반영됩니다.
                  </p>
                  <MagazinePreview title={editTitle} html={editContent} mode="edit" onChange={setEditContent} onTitleChange={setEditTitle} />
                </>
              )}
              {viewMode === 'source' && (
                <textarea className={styles.contentTextarea} value={editContent} onChange={(e) => setEditContent(e.target.value)} spellCheck={false} />
              )}

              <div className={styles.thumbRow}>
                <label className={styles.label}>썸네일 (매거진 카드 이미지)</label>
                {selected.thumbnail ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={selected.thumbnail} alt="썸네일" className={styles.thumbPreview} />
                ) : (
                  <div className={styles.thumbEmpty}>없음 — 본문 첫 이미지가 카드에 사용됩니다</div>
                )}
                <input type="file" accept="image/*" onChange={handleThumbnail} disabled={busy} />
              </div>

              <div className={styles.footerActions}>
                <button className={styles.primaryBtn} onClick={() => handleSave()} disabled={busy || !dirty}>저장</button>
                {selected.status === 'draft' && (
                  <button className={styles.publishBtn} onClick={() => handleSave({ status: 'pending' }, '검수대기로 보냈습니다.')} disabled={busy}>
                    {dirty ? '저장 후 검수대기로' : '검수대기로 보내기'}
                  </button>
                )}
                {selected.status === 'pending' && (
                  <>
                    <button className={styles.publishBtn} onClick={() => handleSave({ status: 'published' }, '매거진에 발행했습니다.')} disabled={busy}>
                      {dirty ? '저장 후 발행' : '발행'}
                    </button>
                    <button className={styles.dangerBtn} onClick={handleReject} disabled={busy}>발행 안 함</button>
                  </>
                )}
              </div>
              {selected.status === 'pending' && (
                <p className={styles.decisionHint}>검수 포인트를 확인하고 발행 여부를 판단하세요. 발행하면 매거진 맨 위에 올라갑니다.</p>
              )}
            </>
          )}
        </div>
      </div>

      <footer className={styles.footer}>API: {API_BASE}</footer>

      {modal === 'ai' && <AiWriteModal onClose={() => setModal(null)} onCreated={handleAiCreated} />}
      {modal === 'brand' && <BrandKnowledgeModal onClose={() => setModal(null)} />}
    </div>
  );
}
