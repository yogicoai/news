'use client';

import { useRef, useState } from 'react';
import styles from '../admin.module.css';

const PRETENDARD = 'https://cdn.jsdelivr.net/gh/orioncactus/pretendard@v1.3.9/dist/web/static/pretendard.css';
const EDITABLE_SELECTOR = 'p, h1, h2, h3, h4, h5, h6, li, td, th, blockquote, span, a';

// 매거진 팝업 본문(.nl-popup-body)과 같은 조건으로 렌더링한다. 스크립트는 실행하지 않는다.
// 미리보기에서는 링크가 새 탭으로 열리고, 편집 모드에서는 글자·링크에 편집 표시를 준다.
function buildDoc(html, editing) {
  const modeCss = editing
    ? `${EDITABLE_SELECTOR.split(', ').map((s) => `${s}:hover`).join(', ')} { outline: 1px dashed rgba(63, 166, 211, 0.6); outline-offset: 2px; cursor: text; }
  a, a * { cursor: pointer !important; }
  a:hover { outline: 2px solid rgba(63, 166, 211, 0.9) !important; }
  [contenteditable] { outline: 2px solid #3fa6d3 !important; outline-offset: 2px; background: rgba(63, 166, 211, 0.06); cursor: text; }`
    : '';
  return `<!doctype html><html><head><meta charset="utf-8">${editing ? '' : '<base target="_blank">'}
<link rel="stylesheet" href="${PRETENDARD}">
<style>
  body { margin: 0; padding: 20px 24px 28px; font-family: 'Pretendard', -apple-system, BlinkMacSystemFont, sans-serif;
         font-size: 14px; line-height: 1.75; color: #333; background: #fff; }
  img { max-width: 100%; height: auto; border-radius: 10px; margin: 8px 0; }
  ${modeCss}
</style></head><body>${html || '<p style="color:#aaa">내용이 없습니다.</p>'}</body></html>`;
}

function supportsPlaintextOnly() {
  const el = document.createElement('div');
  el.contentEditable = 'plaintext-only';
  return el.contentEditable === 'plaintext-only';
}

// 팝업 머리의 제목(매거진 카드·팝업 제목) — 편집 모드에서만 더블클릭으로 고친다
function EditableTitle({ title, editing, onTitleChange }) {
  const [draft, setDraft] = useState(null);

  if (!editing || !onTitleChange) return <h3>{title || '(제목 없음)'}</h3>;

  if (draft === null) {
    return (
      <h3 className={styles.popupTitleEditable} onDoubleClick={() => setDraft(title || '')} title="더블클릭해서 제목 수정">
        {title || '(제목 없음)'}
      </h3>
    );
  }

  const finish = (commit) => {
    if (commit && draft.trim() && draft !== title) onTitleChange(draft.trim());
    setDraft(null);
  };

  return (
    <input
      className={styles.popupTitleInput}
      value={draft}
      autoFocus
      onFocus={(e) => e.target.select()}
      onChange={(e) => setDraft(e.target.value)}
      onBlur={() => finish(true)}
      onKeyDown={(e) => {
        if (e.key === 'Enter') {
          e.preventDefault();
          finish(true);
        } else if (e.key === 'Escape') {
          e.preventDefault();
          finish(false);
        }
      }}
    />
  );
}

/**
 * mode="preview": 보기 전용. 링크는 새 탭으로 열려 주소를 확인할 수 있다.
 * mode="edit": 미리보기와 같은 화면에서 글자 더블클릭 수정, 링크 클릭 시 주소 확인·수정 창.
 * 고친 결과는 onChange(본문 HTML)/onTitleChange로 올려 보내고, 저장은 부모의 저장 버튼으로 한다.
 */
export default function MagazinePreview({ title, html, showHead = true, mode = 'preview', onChange, onTitleChange }) {
  const editing = mode === 'edit';
  const frameRef = useRef(null);
  const wrapRef = useRef(null);
  const [height, setHeight] = useState(480);
  const [linkBox, setLinkBox] = useState(null);
  // 편집으로 올려 보낸 HTML이 다시 내려올 때 iframe을 새로 그리지 않도록(스크롤·편집 위치 유지) 기억해 둔다
  const emittedRef = useRef(null);
  const docRef = useRef({ html: undefined, editing: undefined, doc: '' });
  if ((docRef.current.html !== html && html !== emittedRef.current) || docRef.current.editing !== editing) {
    docRef.current = { html, editing, doc: buildDoc(html, editing) };
  }

  // documentElement.scrollHeight는 iframe 높이보다 작아지지 않아서, 긴 글 다음 짧은 글을 보면 빈 공간이 남는다 → 본문 실제 높이로 잰다
  function measure() {
    const body = frameRef.current?.contentDocument?.body;
    if (body) setHeight(Math.ceil(body.getBoundingClientRect().height) + 4);
  }

  function emit(doc) {
    const next = doc.body.innerHTML;
    emittedRef.current = next;
    onChange?.(next);
    measure();
  }

  function startEditing(doc, el) {
    const before = el.innerHTML;
    el.contentEditable = supportsPlaintextOnly() ? 'plaintext-only' : 'true';
    el.focus();

    const finish = (commit) => {
      el.removeEventListener('keydown', onKey);
      el.removeEventListener('blur', onBlur);
      el.removeEventListener('input', measure);
      if (!commit) el.innerHTML = before;
      el.removeAttribute('contenteditable');
      if (commit && el.innerHTML !== before) emit(doc);
      else measure();
    };
    const onKey = (e) => {
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        finish(true);
      } else if (e.key === 'Escape') {
        e.preventDefault();
        finish(false);
      }
    };
    const onBlur = () => finish(true);
    el.addEventListener('keydown', onKey);
    el.addEventListener('blur', onBlur);
    el.addEventListener('input', measure);
  }

  // 편집 모드에서 링크를 클릭하면 iframe 위에 주소 확인·수정 창을 띄운다
  function openLinkBox(a) {
    const frameRect = frameRef.current.getBoundingClientRect();
    const wrapRect = wrapRef.current.getBoundingClientRect();
    const r = a.getBoundingClientRect();
    const below = frameRect.top - wrapRect.top + r.bottom + 6;
    setLinkBox({
      el: a,
      href: a.getAttribute('href') || '',
      text: a.textContent.trim(),
      top: below + 160 > wrapRect.height ? frameRect.top - wrapRect.top + r.top - 166 : below,
      left: Math.max(8, Math.min(frameRect.left - wrapRect.left + r.left, wrapRect.width - 368)),
    });
  }

  function applyLink(href) {
    const doc = frameRef.current?.contentDocument;
    if (!linkBox || !doc) return;
    if (href.trim() && href.trim() !== linkBox.href) {
      linkBox.el.setAttribute('href', href.trim());
      emit(doc);
    }
    setLinkBox(null);
  }

  function handleLoad() {
    const doc = frameRef.current?.contentDocument;
    if (!doc) return;
    setLinkBox(null);
    measure();
    doc.querySelectorAll('img').forEach((img) => img.addEventListener('load', measure));
    if (!editing) return;

    doc.addEventListener('click', (e) => {
      const a = e.target.closest?.('a');
      if (!a || a.isContentEditable) return;
      e.preventDefault();
      openLinkBox(a);
    });
    doc.addEventListener('dblclick', (e) => {
      const el = e.target.closest?.(EDITABLE_SELECTOR);
      if (!el || el.isContentEditable || !el.textContent.trim()) return;
      setLinkBox(null);
      startEditing(doc, el);
    });
  }

  return (
    <div className={styles.popupBox} ref={wrapRef} style={{ position: 'relative' }}>
      {showHead && (
        <div className={styles.popupHead}>
          <EditableTitle title={title} editing={editing} onTitleChange={onTitleChange} />
          <span className={styles.popupClose}>×</span>
        </div>
      )}
      <iframe
        ref={frameRef}
        title="매거진 미리보기"
        className={styles.popupFrame}
        style={{ height }}
        srcDoc={docRef.current.doc}
        sandbox="allow-same-origin allow-popups allow-popups-to-escape-sandbox"
        onLoad={handleLoad}
      />
      {linkBox && <LinkBox box={linkBox} onApply={applyLink} onClose={() => setLinkBox(null)} />}
    </div>
  );
}

function LinkBox({ box, onApply, onClose }) {
  const [href, setHref] = useState(box.href);
  const isProduct = /yogibo\.kr\/product\//.test(href);
  const productNo = (href.match(/product_no=(\d+)/) || [])[1];
  return (
    <div className={styles.linkBox} style={{ top: box.top, left: box.left }}>
      <div className={styles.linkBoxHead}>
        <span>🔗 {box.text ? `"${box.text.slice(0, 24)}${box.text.length > 24 ? '…' : ''}"` : '링크'}</span>
        <button className={styles.linkBoxClose} onClick={onClose}>×</button>
      </div>
      {isProduct && productNo && <div className={styles.linkBoxMeta}>국내몰 상품 {productNo}번</div>}
      <input
        className={styles.linkBoxInput}
        value={href}
        autoFocus
        onChange={(e) => setHref(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === 'Enter') onApply(href);
          if (e.key === 'Escape') onClose();
        }}
      />
      <div className={styles.linkBoxActions}>
        <button className={styles.secondaryBtn} onClick={() => window.open(href, '_blank', 'noopener')} disabled={!href}>
          새 탭에서 열기
        </button>
        <button className={styles.publishBtn} onClick={() => onApply(href)}>주소 적용</button>
      </div>
    </div>
  );
}
