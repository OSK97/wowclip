import React from 'react';
import { AbsoluteFill, Img, staticFile, useVideoConfig } from 'remotion';

export interface InstagramUIProps {
	/** Master switch so a template can render the overlay only when previewing */
	enabled?: boolean;
	/** Reels feed header ("Reels" + camera) */
	showHeader?: boolean;
	/** Dark scrims Instagram paints over the video so its chrome stays readable */
	showScrim?: boolean;

	username?: string;
	verified?: boolean;
	/** Avatar image in public/ or a full URL. Falls back to a gradient ring. */
	avatarSrc?: string;
	showFollow?: boolean;

	/** Second line under the username, e.g. "Ishuq Haque - AIRTEL PHONK". Hidden when empty. */
	audioTitle?: string;
	/** Square audio / original-clip thumbnail at the bottom right of the caption row */
	audioThumbSrc?: string;

	/** Caption text. @mentions are dimmed the way Instagram dims them. */
	caption?: string;
	/** Appended after the caption in grey */
	captionSuffix?: string;

	likes?: number | string;
	comments?: number | string;
	reposts?: number | string;
	shares?: number | string;

	/**
	 * Distance from the bottom of the frame to the bottom of the caption block, in
	 * 1080-wide units. The screenshots came from a 20.5:9 phone where Instagram parks
	 * its chrome directly above the persistent comment bar; on a true 9:16 frame the
	 * chrome instead floats above the gesture bar, which is what this default models.
	 */
	bottomInset?: number;
	/** Distance from the top of the frame to the header row, in 1080-wide units */
	topInset?: number;
}

// Everything below is authored in a 1080-wide coordinate space and then scaled to the
// real composition width, so the chrome keeps true phone proportions at any frame size.
const BASE_W = 1080;

const SIDE = 40;
const RAIL_RIGHT = 45;
const ICON = 68;
const COUNT_GAP = 24;
const COUNT_SIZE = 34;
const RAIL_GAP = 46;
const RAIL_TO_INFO = 46;

const AVATAR = 82;
const NAME_SIZE = 37;
const MUSIC_SIZE = 30;
const CAPTION_SIZE = 37;
const AUDIO_THUMB = 70;

const FONT =
	'Inter, "Helvetica Neue", "Segoe UI", Roboto, -apple-system, system-ui, sans-serif';
const SHADOW = '0 1px 3px rgba(0,0,0,0.45)';
const DIM = 'rgba(255,255,255,0.62)';

const resolveSrc = (src?: string) => {
	if (!src) return '';
	if (src.startsWith('http://') || src.startsWith('https://') || src.startsWith('data:')) {
		return src;
	}
	return staticFile(src);
};

const formatCount = (v?: number | string) => {
	if (v === undefined || v === null || v === '') return '';
	if (typeof v === 'string') return v;
	if (v >= 1_000_000)
		return `${(v / 1_000_000).toFixed(v >= 10_000_000 ? 0 : 1).replace(/\.0$/, '')}M`;
	if (v >= 10_000) return `${(v / 1000).toFixed(v >= 100_000 ? 0 : 1).replace(/\.0$/, '')}K`;
	return v.toLocaleString('en-US');
};

const HeartIcon: React.FC = () => (
	<svg viewBox="0 0 24 24" width={ICON} height={ICON} fill="#ffffff">
		<path d="M16.792 3.904A4.989 4.989 0 0 1 21.5 9.122c0 3.072-2.652 4.959-5.197 7.222-2.512 2.243-3.865 3.469-4.303 3.752-.477-.309-2.143-1.823-4.303-3.752C5.141 14.072 2.5 12.167 2.5 9.122a4.989 4.989 0 0 1 4.708-5.218 4.21 4.21 0 0 1 3.675 1.941c.84 1.175.98 1.763 1.12 1.763s.278-.588 1.11-1.766a4.17 4.17 0 0 1 3.679-1.938m0-2a6.04 6.04 0 0 0-4.797 2.127 6.052 6.052 0 0 0-4.787-2.127A6.985 6.985 0 0 0 .5 9.122c0 3.61 2.55 5.827 5.015 7.97.283.246.569.494.853.747l1.027.918a44.998 44.998 0 0 0 3.518 3.018 2 2 0 0 0 2.174 0 45.263 45.263 0 0 0 3.626-3.115l.922-.824c.293-.26.59-.519.885-.774 2.334-2.025 4.98-4.32 4.98-7.94a6.985 6.985 0 0 0-6.708-7.218Z" />
	</svg>
);

const CommentIcon: React.FC = () => (
	<svg viewBox="0 0 24 24" width={ICON} height={ICON}>
		<path
			d="M20.656 17.008a9.993 9.993 0 1 0-3.59 3.615L22 22Z"
			fill="none"
			stroke="#ffffff"
			strokeLinejoin="round"
			strokeWidth={2}
		/>
	</svg>
);

const RepostIcon: React.FC = () => (
	<svg viewBox="0 0 24 24" width={ICON} height={ICON} fill="#ffffff">
		<path d="M19.998 9.497a1 1 0 0 0-1 1v4.228a3.274 3.274 0 0 1-3.27 3.27h-5.313l1.791-1.787a1 1 0 0 0-1.412-1.416L7.29 18.287a1.004 1.004 0 0 0-.294.707v.001c0 .023.012.042.013.065a.923.923 0 0 0 .281.643l3.502 3.504a1 1 0 0 0 1.414-1.414l-1.797-1.798h5.318a5.276 5.276 0 0 0 5.271-5.27V10.497a1 1 0 0 0-1-1Zm-6.41-3.496-1.795 1.795a1 1 0 1 0 1.414 1.414l3.5-3.5a1.003 1.003 0 0 0 0-1.417l-3.5-3.5a1 1 0 0 0-1.414 1.414l1.794 1.794H8.27A5.277 5.277 0 0 0 3 9.271V13.5a1 1 0 0 0 2 0V9.271a3.275 3.275 0 0 1 3.27-3.27Z" />
	</svg>
);

const ShareIcon: React.FC = () => (
	<svg viewBox="0 0 24 24" width={ICON} height={ICON} fill="none" stroke="#ffffff" strokeWidth={2}>
		<line x1="22" y1="3" x2="9.218" y2="10.083" strokeLinejoin="round" />
		<polygon
			points="11.698 20.334 22 3.001 2 3.001 9.218 10.084 11.698 20.334"
			strokeLinejoin="round"
		/>
	</svg>
);

const SaveIcon: React.FC = () => (
	<svg viewBox="0 0 24 24" width={ICON} height={ICON} fill="none" stroke="#ffffff" strokeWidth={2}>
		<polygon points="20 21 12 13.44 4 21 4 3 20 3 20 21" strokeLinejoin="round" />
	</svg>
);

const MoreIcon: React.FC = () => (
	<svg viewBox="0 0 24 24" width={ICON * 0.62} height={ICON * 0.62} fill="#ffffff">
		<circle cx="12" cy="4.6" r="1.9" />
		<circle cx="12" cy="12" r="1.9" />
		<circle cx="12" cy="19.4" r="1.9" />
	</svg>
);

const CameraIcon: React.FC = () => (
	<svg viewBox="0 0 24 24" width={ICON} height={ICON} fill="none" stroke="#ffffff" strokeWidth={1.8}>
		<path
			d="M20.5 6.5h-2.2l-1.1-1.9a1.6 1.6 0 0 0-1.4-.8H8.2a1.6 1.6 0 0 0-1.4.8L5.7 6.5H3.5a2 2 0 0 0-2 2v9.2a2 2 0 0 0 2 2h17a2 2 0 0 0 2-2V8.5a2 2 0 0 0-2-2Z"
			strokeLinejoin="round"
		/>
		<circle cx="12" cy="13" r="4" />
	</svg>
);

const MusicIcon: React.FC = () => (
	<svg viewBox="0 0 24 24" width={MUSIC_SIZE} height={MUSIC_SIZE} fill="#ffffff">
		<path d="M20.5 2.6a1 1 0 0 0-.84-.22l-10 2A1 1 0 0 0 8.86 5.4v9.02a4 4 0 1 0 2 3.46V9.6l8-1.6v4.42a4 4 0 1 0 2 3.46V3.37a1 1 0 0 0-.36-.77Z" />
	</svg>
);

const VerifiedBadge: React.FC = () => (
	<svg viewBox="0 0 24 24" width={NAME_SIZE * 0.95} height={NAME_SIZE * 0.95}>
		<path
			fill="#3897f0"
			d="M12 .5 14.6 3l3.5-.6 1.2 3.4 3.2 1.7-1.3 3.4 1.3 3.4-3.2 1.7-1.2 3.4-3.5-.6L12 23.5 9.4 21l-3.5.6-1.2-3.4L1.5 16.5l1.3-3.4-1.3-3.4 3.2-1.7L5.9 4.6l3.5.6Z"
		/>
		<path fill="#ffffff" d="m10.83 15.6-3.1-3.1 1.42-1.41 1.68 1.68 4.02-4.02 1.41 1.42Z" />
	</svg>
);

const RailItem: React.FC<{ icon: React.ReactNode; count?: string }> = ({ icon, count }) => (
	<div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
		<div style={{ width: ICON, height: ICON, display: 'flex' }}>{icon}</div>
		{count ? (
			<div
				style={{
					marginTop: COUNT_GAP,
					fontSize: COUNT_SIZE,
					lineHeight: 1,
					fontWeight: 600,
					color: '#ffffff',
					textShadow: SHADOW,
				}}
			>
				{count}
			</div>
		) : null}
	</div>
);

/** Splits a caption so @handles render in Instagram's dimmed link colour. */
const renderCaption = (text: string) =>
	text.split(/(@[A-Za-z0-9._]+)/g).map((part, i) =>
		part.startsWith('@') ? (
			<span key={i} style={{ color: DIM }}>
				{part}
			</span>
		) : (
			<span key={i}>{part}</span>
		),
	);

export const InstagramUI: React.FC<InstagramUIProps> = ({
	enabled = true,
	showHeader = true,
	showScrim = true,
	username = 'realityquotes.hub',
	verified = false,
	avatarSrc,
	showFollow = true,
	audioTitle = 'Ishuq Haque · AIRTEL PHONK',
	audioThumbSrc,
	caption = 'Follow @realityquotes.hub for more relatable content',
	captionSuffix = '… more',
	likes = 195000,
	comments = 337,
	reposts = 8470,
	shares = 30600,
	bottomInset = 96,
	topInset = 74,
}) => {
	const { width, height } = useVideoConfig();

	const scale = width / BASE_W;
	const baseHeight = height / scale;

	const avatar = resolveSrc(avatarSrc);
	const audioThumb = resolveSrc(audioThumbSrc);

	// Height of the name row + caption block, so the action rail can sit above it at
	// the same gap Instagram uses.
	const captionLine = Math.round(CAPTION_SIZE * 1.35);
	const infoHeight = AVATAR + 26 + captionLine;

	if (!enabled) return null;

	return (
		<AbsoluteFill style={{ pointerEvents: 'none' }}>
			<div
				style={{
					position: 'absolute',
					left: 0,
					top: 0,
					width: BASE_W,
					height: baseHeight,
					transform: `scale(${scale})`,
					transformOrigin: 'top left',
					fontFamily: FONT,
				}}
			>
				{showScrim ? (
					<>
						<div
							style={{
								position: 'absolute',
								left: 0,
								right: 0,
								top: 0,
								height: baseHeight * 0.18,
								background: 'linear-gradient(to bottom, rgba(0,0,0,0.42), rgba(0,0,0,0))',
							}}
						/>
						<div
							style={{
								position: 'absolute',
								left: 0,
								right: 0,
								bottom: 0,
								height: baseHeight * 0.34,
								background: 'linear-gradient(to top, rgba(0,0,0,0.62), rgba(0,0,0,0))',
							}}
						/>
					</>
				) : null}

				{showHeader ? (
					<div
						style={{
							position: 'absolute',
							left: SIDE,
							right: RAIL_RIGHT,
							top: topInset,
							height: ICON,
							display: 'flex',
							alignItems: 'center',
							justifyContent: 'space-between',
						}}
					>
						<div
							style={{
								fontSize: 46,
								fontWeight: 700,
								color: '#ffffff',
								letterSpacing: -0.5,
								textShadow: SHADOW,
							}}
						>
							Reels
						</div>
						<CameraIcon />
					</div>
				) : null}

				{/* Right action rail */}
				<div
					style={{
						position: 'absolute',
						right: RAIL_RIGHT,
						bottom: bottomInset + infoHeight + RAIL_TO_INFO,
						display: 'flex',
						flexDirection: 'column',
						alignItems: 'center',
						gap: RAIL_GAP,
					}}
				>
					<RailItem icon={<HeartIcon />} count={formatCount(likes)} />
					<RailItem icon={<CommentIcon />} count={formatCount(comments)} />
					<RailItem icon={<RepostIcon />} count={formatCount(reposts)} />
					<RailItem icon={<ShareIcon />} count={formatCount(shares)} />
					<RailItem icon={<SaveIcon />} />
				</div>

				{/* Bottom info block */}
				<div
					style={{
						position: 'absolute',
						left: SIDE,
						right: RAIL_RIGHT,
						bottom: bottomInset,
					}}
				>
					<div style={{ display: 'flex', alignItems: 'center', height: AVATAR }}>
						<div
							style={{
								width: AVATAR,
								height: AVATAR,
								borderRadius: '50%',
								overflow: 'hidden',
								flexShrink: 0,
								border: '2px solid rgba(255,255,255,0.9)',
								background: 'linear-gradient(135deg, #4b4b4b, #1c1c1c)',
							}}
						>
							{avatar ? (
								<Img src={avatar} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
							) : null}
						</div>

						<div style={{ minWidth: 0, marginLeft: 26 }}>
							<div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
								<div
									style={{
										fontSize: NAME_SIZE,
										fontWeight: 600,
										color: '#ffffff',
										whiteSpace: 'nowrap',
										overflow: 'hidden',
										textOverflow: 'ellipsis',
										textShadow: SHADOW,
									}}
								>
									{username}
								</div>
								{verified ? <VerifiedBadge /> : null}
							</div>

							{audioTitle ? (
								<div
									style={{
										display: 'flex',
										alignItems: 'center',
										gap: 10,
										marginTop: 6,
										maxWidth: 470,
									}}
								>
									<MusicIcon />
									<div
										style={{
											fontSize: MUSIC_SIZE,
											color: '#ffffff',
											whiteSpace: 'nowrap',
											overflow: 'hidden',
											textOverflow: 'ellipsis',
											textShadow: SHADOW,
										}}
									>
										{audioTitle}
									</div>
								</div>
							) : null}
						</div>

						{showFollow ? (
							<div
								style={{
									marginLeft: 36,
									flexShrink: 0,
									width: 174,
									height: 56,
									borderRadius: 12,
									border: '1.6px solid rgba(255,255,255,0.85)',
									display: 'flex',
									alignItems: 'center',
									justifyContent: 'center',
									fontSize: 32,
									fontWeight: 600,
									color: '#ffffff',
								}}
							>
								Follow
							</div>
						) : null}

						<div style={{ marginLeft: 'auto', flexShrink: 0, display: 'flex' }}>
							<MoreIcon />
						</div>
					</div>

					<div style={{ display: 'flex', alignItems: 'flex-end', marginTop: 26 }}>
						<div
							style={{
								flex: 1,
								minWidth: 0,
								marginRight: 40,
								fontSize: CAPTION_SIZE,
								lineHeight: 1.35,
								color: '#ffffff',
								textShadow: SHADOW,
								display: '-webkit-box',
								WebkitLineClamp: 2,
								WebkitBoxOrient: 'vertical',
								overflow: 'hidden',
							}}
						>
							{renderCaption(caption)}
							{captionSuffix ? <span style={{ color: DIM }}>{captionSuffix}</span> : null}
						</div>

						<div
							style={{
								width: AUDIO_THUMB,
								height: AUDIO_THUMB,
								flexShrink: 0,
								borderRadius: 12,
								overflow: 'hidden',
								border: '2px solid rgba(255,255,255,0.9)',
								background: 'linear-gradient(135deg, #3a3a3a, #141414)',
							}}
						>
							{audioThumb ? (
								<Img
									src={audioThumb}
									style={{ width: '100%', height: '100%', objectFit: 'cover' }}
								/>
							) : null}
						</div>
					</div>
				</div>
			</div>
		</AbsoluteFill>
	);
};

export default InstagramUI;
