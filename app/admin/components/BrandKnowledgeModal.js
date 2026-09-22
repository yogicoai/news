'use client';

import { useEffect, useState } from 'react';
import { api } from '../api';
import styles from '../admin.module.css';

const CATEGORIES = [
  { key: 'product-spec', label: '제품' },
  { key: 'brand-story', label: '브랜드' },
  { key: 'promotion', label: '프로모션' },
];
const EMPTY = { title: '', category: 'product-spec', content: '' };

export default function BrandKnowledgeModal({ onClose }) {
  const [items, setItems] = useState([]);
  const [form, setForm] = useState(EMPTY);
  const [editingId, setEditingId] = useState(null);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState(null);

  async function load() {
    try {
      setItems((await api.brandList()).data || []);
    } catch (err) {
      setMessage({ type: 'error', text: err.message });
    }
  }

  useEffect(() => {
    load();
  }, []);

  function startEdit(item) {
    setEditingId(item._id);
    setForm({ title: item.title, category: item.category, content: item.content });
  }

  function reset() {
    setEditingId(null);
    setForm(EMPTY);
  }

  async function handleSave() {
    if (!form.title.trim() || !form.content.trim()) {
      setMessage({ type: 'error', text: '제목과 내용을 입력해주세요.' });
      return;
    }
    setBusy(true);
    try {
      if (editingId) await api.brandUpdate(editingId, form);
      else await api.brandCreate(form);
      setMessage({ type: 'success', text: '저장되었습니다.' });
      reset();
      await load();
    } catch (err) {
      setMessage({ type: 'error', text: err.message });
    } finally {
      setBusy(false);
    }
  }

  async function handleDelete(item) {
    if (!confirm(`"${item.title}" 자료를 삭제할까요?`)) return;
    setBusy(true);
    try {
      await api.brandRemove(item._id);
      if (editingId === item._id) reset();
      await load();
    } catch (err) {
      setMessage({ type: 'error', text: err.message });
    } finally {
      setBusy(false);
    }
  }

  async function handleExtract(e) {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    setBusy(true);
    setMessage(null);
    try {
      const res = await api.brandExtract(file);
      setForm((f) => ({ ...f, title: f.title || file.name.replace(/\.[^.]+$/, ''), content: res.text }));
      setMessage({ type: 'success', text: '문서 내용을 추출했습니다. 확인 후 저장하세요.' });
    } catch (err) {
      setMessage({ type: 'error', text: err.message });
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className={styles.modalOverlay} onClick={(e) => e.target === e.currentTarget && !busy && onClose()}>
      <div className={styles.modalWide}>
        <div className={styles.modalHead}>
          <h2>브랜드자료</h2>
          <button className={styles.modalClose} onClick={onClose} disabled={busy}>×</button>
        </div>
        <p className={styles.modalHint}>AI 작성 시 참고하는 제품 사양·브랜드 스토리·프로모션 정보입니다.</p>

        {message && <div className={message.type === 'error' ? styles.msgError : styles.msgSuccess}>{message.text}</div>}

        <div className={styles.brandLayout}>
          <div className={styles.brandList}>
            {items.length === 0 && <div className={styles.empty}>등록된 자료가 없습니다.</div>}
            {items.map((item) => (
              <div key={item._id} className={editingId === item._id ? styles.cardActive : styles.card}>
                <div className={styles.cardTitle}>{item.title}</div>
                <div className={styles.cardMeta}>
                  <span>{CATEGORIES.find((c) => c.key === item.category)?.label || item.category}</span>
                  <button className={styles.linkBtn} onClick={() => startEdit(item)}>수정</button>
                  <button className={styles.linkDanger} onClick={() => handleDelete(item)}>삭제</button>
                </div>
              </div>
            ))}
          </div>

          <div className={styles.brandForm}>
            <label className={styles.label}>{editingId ? '자료 수정' : '새 자료'}</label>
            <input
              className={styles.titleInput}
              placeholder="제목 (예: 요기보 맥스 제품 사양)"
              value={form.title}
              onChange={(e) => setForm({ ...form, title: e.target.value })}
              disabled={busy}
            />
            <select className={styles.select} value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })} disabled={busy}>
              {CATEGORIES.map((c) => (
                <option key={c.key} value={c.key}>{c.label}</option>
              ))}
            </select>
            <textarea
              className={styles.modalTextarea}
              style={{ minHeight: 220 }}
              placeholder="내용"
              value={form.content}
              onChange={(e) => setForm({ ...form, content: e.target.value })}
              disabled={busy}
            />
            <label className={styles.label}>이미지 · PDF에서 내용 추출 (Claude 사용)</label>
            <input type="file" accept="image/*,application/pdf" onChange={handleExtract} disabled={busy} />

            <div className={styles.modalActions}>
              {editingId && <button className={styles.primaryBtn} onClick={reset} disabled={busy}>새로 작성</button>}
              <button className={styles.publishBtn} onClick={handleSave} disabled={busy}>
                {busy ? '처리 중…' : '저장'}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
