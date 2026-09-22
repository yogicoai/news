// 운영: adminChat 서버(CloudType)에 붙은 매거진 모듈. 로컬은 .env.local 로 덮어쓴다
const BASE = process.env.NEXT_PUBLIC_API_BASE || 'https://port-0-admichat-lzgmwhc4d9883c97.sel4.cloudtype.app/yogibonews';

async function request(path, options = {}) {
  const isForm = options.body instanceof FormData;
  const res = await fetch(`${BASE}${path}`, {
    ...options,
    headers: isForm ? options.headers : { 'Content-Type': 'application/json', ...(options.headers || {}) },
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok || data.success === false) {
    throw new Error(data.message || `요청 실패 (${res.status})`);
  }
  return data;
}

const json = (method, body) => ({ method, body: JSON.stringify(body) });

function fileForm(file) {
  const form = new FormData();
  form.append('file', file);
  return form;
}

export const api = {
  list: (status, { limit = 100, offset = 0, archived = false } = {}) =>
    request(
      `/api/yogibo-jp-news?status=${encodeURIComponent(status)}&limit=${limit}&offset=${offset}${archived ? '&archived=1' : ''}`
    ),
  pipelineStatus: () => request('/api/pipeline/status'),
  create: (payload) => request('/api/yogibo-jp-news', json('POST', payload)),
  update: (id, payload) => request(`/api/yogibo-jp-news/${id}`, json('PUT', payload)),
  remove: (id) => request(`/api/yogibo-jp-news/${id}`, { method: 'DELETE' }),
  reorder: (order) => request('/api/yogibo-jp-news/order', json('PUT', { order })),
  convert: (id) => request(`/api/yogibo-jp-news/${id}/convert`, { method: 'POST' }),
  translate: (title, content) => request('/api/translate-news', json('POST', { title, content })),
  generate: (payload) => request('/api/yogibo-jp-news/generate', json('POST', payload)),
  runPipeline: () => request('/api/pipeline/run', { method: 'POST' }),
  uploadThumbnail: (id, file) => request(`/api/yogibo-jp-news/${id}/thumbnail-upload`, { method: 'POST', body: fileForm(file) }),
  uploadImage: (file) => request('/api/yogibo-jp-news/upload-image', { method: 'POST', body: fileForm(file) }),

  brandList: () => request('/api/brand-knowledge'),
  brandCreate: (payload) => request('/api/brand-knowledge', json('POST', payload)),
  brandUpdate: (id, payload) => request(`/api/brand-knowledge/${id}`, json('PUT', payload)),
  brandRemove: (id) => request(`/api/brand-knowledge/${id}`, { method: 'DELETE' }),
  brandExtract: (file) => request('/api/brand-knowledge/extract', { method: 'POST', body: fileForm(file) }),
};

export { BASE as API_BASE };
