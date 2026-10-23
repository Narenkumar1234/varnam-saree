import { ImageResponse } from 'next/og';

export const size = {
  width: 180,
  height: 180,
};
export const contentType = 'image/png';

export default function AppleIcon() {
  return new ImageResponse(
    (
      <div
        style={{
          width: '100%',
          height: '100%',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          backgroundColor: '#176047',
          borderRadius: '40px',
        }}
      >
        <svg
          width="140"
          height="140"
          viewBox="0 0 64 64"
        >
          <path fill="#e7c77d" d="M18.2 14h11.2L32 40.6 34.6 14h11.2L34.4 52h-4.8L18.2 14z" />
        </svg>
      </div>
    ),
    {
      ...size,
    }
  );
}
