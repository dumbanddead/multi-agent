import { Html, Head, Main, NextScript } from 'next/document';

export default function Document() {
  return (
    <Html lang="en">
      <Head>
        <script src="https://cdn.tailwindcss.com" />
        <script src="https://cdn.jsdelivr.net/npm/ace-builds@1.33.0/src-min-noconflict/ace.min.js" />
        <script dangerouslySetInnerHTML={{
          __html: `
            tailwind.config = {
              theme: {
                extend: {
                  fontFamily: { display: ['-apple-system','BlinkMacSystemFont','Segoe UI','Roboto','sans-serif'] },
                }
              }
            }
          `
        }} />
      </Head>
      <body>
        <Main />
        <NextScript />
      </body>
    </Html>
  );
}
