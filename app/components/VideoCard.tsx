import { formatCount, formatDuration, type Video } from "@/app/lib/types";

export function VideoCard({ video }: { video: Video }) {
  return (
    <div className="flex gap-4 border border-[#333333] bg-[#262626] p-4">
      {video.thumbnail && (
        <div className="relative shrink-0">
          {/* Plain img: YouTube thumbnail hosts would each need to be
              allow-listed in next.config for next/image. */}
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={video.thumbnail}
            alt=""
            width={160}
            height={90}
            className="h-[90px] w-[160px] object-cover"
          />
          <span className="absolute right-1 bottom-1 bg-black/85 px-1.5 py-0.5 font-mono text-[11px] text-white">
            {formatDuration(video.durationSeconds)}
          </span>
        </div>
      )}

      <div className="min-w-0 flex-1">
        <h2 className="line-clamp-2 text-[15px] leading-snug text-[#ededed]">
          {video.title}
        </h2>
        <p className="mt-1.5 text-[13px] text-[#8a8a8a]">{video.channel}</p>

        <dl className="mt-3 flex flex-wrap gap-x-5 gap-y-1 text-[12px] text-[#6b6b6b]">
          <div className="flex gap-1.5">
            <dt>Views</dt>
            <dd className="text-[#a8a8a8]">{formatCount(video.viewCount)}</dd>
          </div>
          <div className="flex gap-1.5">
            <dt>Likes</dt>
            <dd className="text-[#a8a8a8]">{formatCount(video.likeCount)}</dd>
          </div>
          <div className="flex gap-1.5">
            <dt>Comments</dt>
            <dd className="text-[#a8a8a8]">{formatCount(video.commentCount)}</dd>
          </div>
          <div className="flex gap-1.5">
            <dt>ID</dt>
            <dd className="font-mono text-[#a8a8a8]">{video.videoId}</dd>
          </div>
        </dl>
      </div>
    </div>
  );
}
