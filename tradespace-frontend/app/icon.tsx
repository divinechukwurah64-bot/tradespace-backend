import { ImageResponse } from 'next/og';

export const size = { width: 512, height: 512 };
export const contentType = 'image/png';

export default function Icon() {
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
          borderRadius: 96,
        }}
      >
        <div style={{ width: 320, height: 88, background: '#FFFFFF', display: 'flex' }} />
        <div style={{ width: 88, height: 200, background: '#FFFFFF', display: 'flex' }} />
      </div>
    ),
    { ...size }
  );
}