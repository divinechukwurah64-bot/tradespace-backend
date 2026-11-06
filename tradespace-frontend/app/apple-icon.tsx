import { ImageResponse } from 'next/og';

export const size = { width: 180, height: 180 };
export const contentType = 'image/png';

export default function AppleIcon() {
  return new ImageResponse(
    (
      <div
        style={{
          width: '100%',
          height: '100%',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          background: '#1D4ED8',
        }}
      >
        <div style={{ width: 112, height: 31, background: '#FFFFFF', display: 'flex' }} />
        <div style={{ width: 31, height: 70, background: '#FFFFFF', display: 'flex' }} />
      </div>
    ),
    { ...size }
  );
}