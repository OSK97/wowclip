import { Img, Video, useCurrentFrame, interpolate, spring, useVideoConfig } from 'remotion';
import { resolveAsset } from './resolveAsset';

interface MediaGridProps {
  images?: string[];
  video?: string;
  videoWidth?: number;
  videoHeight?: number;
  entranceDelay?: number;
  platform?: 'twitter' | 'instagram' | 'reddit';
}

export const MediaGrid: React.FC<MediaGridProps> = ({ 
  images, 
  video, 
  videoWidth, 
  videoHeight, 
  entranceDelay = 30, 
  platform = 'twitter' 
}) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  if (!video && (!images || images.length === 0)) return null;

  // Staggered entrance animation for images
  const getScale = (index: number) => {
    return spring({
      frame: Math.max(0, frame - entranceDelay - (index * 4)),
      fps,
      config: { damping: 14, mass: 0.8 }
    });
  };

  const getOpacity = (index: number) => {
    return interpolate(frame, [entranceDelay + (index * 4), entranceDelay + (index * 4) + 10], [0, 1], {
      extrapolateLeft: 'clamp',
      extrapolateRight: 'clamp'
    });
  };

  const isIG = platform === 'instagram';
  
  const commonImgStyle: React.CSSProperties = {
    objectFit: 'cover',
    width: '100%',
    height: '100%',
    // IG has no internal border radius. Twitter has 0 internal, outer is clipped by container.
    borderRadius: 0,
    border: isIG ? 'none' : '1px solid rgba(255, 255, 255, 0.1)',
  };

  const renderImage = (src: string, index: number, style?: React.CSSProperties) => (
    <div 
      key={index} 
      style={{ 
        ...style,
        opacity: getOpacity(index),
        transform: `scale(${0.9 + (getScale(index) * 0.1)})`,
        overflow: 'hidden',
        position: 'relative'
      }}
    >
      <Img src={resolveAsset(src)} style={commonImgStyle} />
    </div>
  );

  // Layout Logic
  const gap = isIG ? 4 : 2;
  const marginTop = isIG ? 0 : 20;
  // Twitter outer radius is 16px, IG is 0.
  const outerRadius = isIG ? 0 : 16;
  
  const containerStyle: React.CSSProperties = {
    width: '100%',
    marginTop,
    aspectRatio: isIG && (video || (images && images.length === 1)) ? '4/5' : '16/9', // IG often uses 4:5 for single
    borderRadius: outerRadius,
    overflow: 'hidden',
  };

  // Video Layout Logic
  if (video) {
    const resolvedVideo = resolveAsset(video);
    
    // Determine aspect ratio synchronously from props
    let aspect = 16 / 9;
    if (videoWidth && videoHeight) {
      aspect = videoWidth / videoHeight;
    }

    const isPortrait = aspect < 1;

    let videoContainerStyle: React.CSSProperties = {
      ...containerStyle,
      backgroundColor: '#000000',
      display: 'flex',
      justifyContent: 'center',
      alignItems: 'center',
    };

    if (isPortrait) {
      // Capping height at 750px for portrait layout and scaling width dynamically
      videoContainerStyle = {
        ...videoContainerStyle,
        height: 750,
        width: 'auto',
        aspectRatio: String(aspect),
        alignSelf: 'center', // Center portrait video in parent card container
      };
    } else {
      videoContainerStyle = {
        ...videoContainerStyle,
        width: '100%',
        aspectRatio: String(aspect),
      };
    }

    return (
      <div 
        style={{ 
          ...videoContainerStyle,
          opacity: getOpacity(0),
          transform: `scale(${0.9 + (getScale(0) * 0.1)})`,
        }}
      >
        <Video 
          src={resolvedVideo} 
          style={{
            width: '100%',
            height: '100%',
            objectFit: 'contain',
          }} 
          muted 
          autoPlay 
          loop 
          crossOrigin="anonymous" 
        />
      </div>
    );
  }

  // Image Layout Logic
  if (!images) return null;

  if (images.length === 1) {
    return (
      <div style={containerStyle}>
        {renderImage(images[0], 0, { width: '100%', height: '100%' })}
      </div>
    );
  }

  if (images.length === 2) {
    return (
      <div style={{ ...containerStyle, display: 'flex', gap }}>
        {renderImage(images[0], 0, { flex: 1 })}
        {renderImage(images[1], 1, { flex: 1 })}
      </div>
    );
  }

  if (images.length === 3) {
    return (
      <div style={{ ...containerStyle, display: 'flex', gap }}>
        {renderImage(images[0], 0, { flex: 1 })}
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap }}>
          {renderImage(images[1], 1, { flex: 1 })}
          {renderImage(images[2], 2, { flex: 1 })}
        </div>
      </div>
    );
  }

  // 4 or more (cap at 4 visually)
  return (
    <div style={{ ...containerStyle, display: 'grid', gridTemplateColumns: '1fr 1fr', gridTemplateRows: '1fr 1fr', gap }}>
      {renderImage(images[0], 0)}
      {renderImage(images[1], 1)}
      {renderImage(images[2], 2)}
      {renderImage(images[3], 3)}
    </div>
  );
};
