'use client';

import { useState } from 'react';
import { api } from '../api';
import { fileToBase64Jpeg } from './imageUtils';
import styles from '../admin.module.css';

const STYLES = [
  { key: 'tips-guide', label: '생활 팁 · 가이드' },
  { key: 'product-launch', label: '신제품 소식' },
  { key: 'event-promo', label: '이벤트 · 프로모션' },
  { key: 'brand-story', label: '브랜드 스토리' },
  { key: 'collab', label: '콜라보 · 한정판' },
];

export default function AiWriteModal({ onClose, onCreated }) {
  const [prompt, setPrompt] = useState('');
  const [style, setStyle] = useState('tips-guide');
  const [files, setFiles] = useState([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);

  async function handleGenerate() {
    if (!prompt.trim()) {
      setError('어떤 기사를 쓸지 입력해주세요.');
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const imageUrls = [];
      for (const f of files) imageUrls.push((await api.uploadImage(f)).url);
      const images = await Promise.all(files.map((f) => fileToBase64Jpeg(f)));

      const generated = await api.generate({ prompt, style, images, imageUrls });
      const created = await api.create({ title: generated.title, content: generated.content, status: 'draft' });
      onCreated(created.data);
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className={styles.modalOverlay} onClick={(e) => e.target === e.currentTarget && !busy && onClose()}>
      <div className={styles.modal}>
        <div className={styles.modalHead}>
          <h2>AI 작성</h2>
          <button className={styles.modalClose} onClick={onClose} disabled={busy}>×</button>
        </div>
        <p className={styles.modalHint}>
          주제와 참고 이미지를 넣으면 v5 매거진 형식 초안을 만들어 &lsquo;원본 · 수동확인&rsquo;에 저장합니다. 브랜드자료에 등록된 내용을 참고합니다.
        </p>

        <label className={styles.label}>톤</label>
        <select className={styles.select} value={style} onChange={(e) => setStyle(e.target.value)} disabled={busy}>
          {STYLES.map((s) => (
            <option key={s.key} value={s.key}>{s.label}</option>
          ))}
        </select>

        <label className={styles.label}>요청 내용</label>
        <textarea
          className={styles.modalTextarea}
          placeholder="예) 가을 캠핑에 어울리는 줄라 시리즈 활용법을 소개해줘. 방수 소재와 세척 방법을 강조."
          value={prompt}
          onChange={(e) => setPrompt(e.target.value)}
          disabled={busy}
        />

        <label className={styles.label}>참고 이미지 (본문에 들어갑니다)</label>
        <input type="file" accept="image/*" multiple onChange={(e) => setFiles([...e.target.files])} disabled={busy} />
        {files.length > 0 && <div className={styles.fileList}>{files.map((f) => f.name).join(', ')}</div>}

        {error && <div className={styles.msgError}>{error}</div>}

        <div className={styles.modalActions}>
          <button className={styles.primaryBtn} onClick={onClose} disabled={busy}>취소</button>
          <button className={styles.publishBtn} onClick={handleGenerate} disabled={busy}>
            {busy ? '작성 중… (1~2분)' : '초안 만들기 (Claude 사용)'}
          </button>
        </div>
      </div>
    </div>
  );
}
