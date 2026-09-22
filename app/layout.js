import './globals.css';

export const metadata = {
  title: '요기보 뉴스레터 관리자',
  description: '일본 블로그 소싱 → 지역이벤트 필터링 → 번역 → 발행 준비 자동화',
};

export default function RootLayout({ children }) {
  return (
    <html lang="ko">
      <body>{children}</body>
    </html>
  );
}
