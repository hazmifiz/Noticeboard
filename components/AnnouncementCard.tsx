'use client';

import { useState } from 'react';
import { sanitizeAnnouncementHtml } from '@/lib/announcement-html';
import GoogleCalendarButton from '@/components/GoogleCalendarButton';
import DownloadCalendarButton from '@/components/DownloadCalendarButton';


export default function AnnouncementCard({ post }: { post: any }) {
  const [isExpanded, setIsExpanded] = useState(false);

  const hasEvent =
  post.event_start &&
  post.event_end &&
  !Number.isNaN(new Date(post.event_start).getTime()) &&
  !Number.isNaN(new Date(post.event_end).getTime()) &&
  new Date(post.event_end).getTime() >
    new Date(post.event_start).getTime();

  const formatEventDate = (value: string) =>
    new Date(value).toLocaleString('en-MY', {
      timeZone: 'Asia/Kuala_Lumpur',
      dateStyle: 'medium',
      timeStyle: 'short',
    });

  // Reusable event information for regular and urgent cards.
  const eventDisplay = hasEvent && (
    <div
      className="mt-4 space-y-3 rounded-xl border border-blue-100 bg-blue-50/50 p-4"
      onClick={(event) => event.stopPropagation()}
    >
      <h3 className="text-sm font-bold text-slate-800">
        📅 Event Information
      </h3>

      <div className="space-y-2 text-sm text-slate-600">
        <p>
          <span className="font-semibold">Start:</span>{' '}
          {formatEventDate(post.event_start)}
        </p>

        <p>
          <span className="font-semibold">End:</span>{' '}
          {formatEventDate(post.event_end)}
        </p>

        {post.event_location && (
          <p>
            <span className="font-semibold">Location:</span>{' '}
            {post.event_location}
          </p>
        )}
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <GoogleCalendarButton
          title={post.title}
          description="Campus event announcement"
          start={post.event_start}
          end={post.event_end}
          location={post.event_location}
        />

        <DownloadCalendarButton
          id={post.id}
          title={post.title}
          description="Campus event announcement"
          start={post.event_start}
          end={post.event_end}
          location={post.event_location}
        />
      </div>
    </div>
  );

  const categoryName = post.announcement_categories?.[0]?.categories?.name || 'General';
  const authorName = post.users?.full_name || 'Campus Staff';
  const timeAgo = new Date(post.created_at).toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric'
  });

  const attachmentUrl = post.attachment_url;

  const isImage = attachmentUrl
    ? /\.(jpg|jpeg|png|webp)(\?|$)/i.test(attachmentUrl)
    : false;

  const isPdf = attachmentUrl
    ? /\.pdf(\?|$)/i.test(attachmentUrl)
    : false;

  const recordView = async () => {
    try {
      const response = await fetch('/api/announcements/view', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          announcementId: post.id,
        }),
      });

      if (!response.ok) {
        console.error('Failed to record announcement view');
      }
    } catch (error) {
      console.error('View tracking error:', error);
    }
  };

  const handleToggle = () => {
    if (!isExpanded) {
      void recordView();
    }

    setIsExpanded((prev) => !prev);
  };

  const attachmentDisplay = attachmentUrl && isExpanded && (
    <div
      className="mt-4 border-t border-slate-200 pt-4"
      onClick={(e) => e.stopPropagation()}
    >
      <p className="mb-2 text-xs font-semibold text-slate-500">
        Attachment
      </p>

      {isImage ? (
        <a
          href={attachmentUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="block"
        >
          <img
            src={attachmentUrl}
            alt={`Attachment for ${post.title}`}
            className="max-h-80 w-full rounded-lg border border-slate-200 object-contain bg-slate-50"
          />
        </a>
      ) : (
        <a
          href={attachmentUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-2 rounded-lg bg-blue-50 px-4 py-2 text-sm font-semibold text-blue-700 hover:bg-blue-100"
        >
          {isPdf ? '📄 View PDF' : '📎 Open Attachment'}
          <span aria-hidden="true">↗</span>
        </a>
      )}
    </div>
  );

  if (post.is_urgent) {
    return (
      <div 
        onClick={handleToggle}
        className="bg-amber-50 border-l-4 border-amber-500 p-4 rounded-r-xl shadow-sm flex justify-between items-start cursor-pointer hover:bg-amber-100/50 transition-colors"
      >
        <div className="w-full">
          <span className="bg-amber-200 text-amber-800 text-[10px] font-bold uppercase px-2 py-0.5 rounded">Urgent Alert</span>
          <h2 className="font-bold text-slate-900 mt-1">{post.title}</h2>
          <div
            className={`announcement-content text-sm text-slate-700 ${
              isExpanded ? '' : 'max-h-24 overflow-hidden'
            }`}
            onClick={(event) => {
              if ((event.target as HTMLElement).closest('a')) {
                event.stopPropagation();
              }
            }}
            dangerouslySetInnerHTML={{
              __html: sanitizeAnnouncementHtml(post.body ?? ''),
            }}
          />

          {attachmentDisplay}
          {eventDisplay}

        </div>
        <span className="text-xs text-slate-400 shrink-0 ml-4">{timeAgo}</span>
      </div>
    );
  }

  return (
    <article
      onClick={handleToggle}
      className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm hover:border-slate-300 transition-all space-y-3 cursor-pointer"
    >
      <div className="flex items-center justify-between text-xs text-slate-500">
        <div className="flex items-center gap-2">
          <span className="font-semibold text-slate-700">{authorName}</span>
          <span>•</span>
          <span className="bg-slate-100 text-slate-600 px-2 py-0.5 rounded font-medium"># {categoryName}</span>
        </div>
        <span>{timeAgo}</span>
      </div>
      
      <h2 className="text-lg font-bold text-slate-900">
        {post.title}
      </h2>
      
      <div
        className={`announcement-content text-sm text-slate-700 ${
          isExpanded ? '' : 'max-h-24 overflow-hidden'
        }`}
        onClick={(event) => {
          if ((event.target as HTMLElement).closest('a')) {
            event.stopPropagation();
          }
        }}
        dangerouslySetInnerHTML={{
          __html: sanitizeAnnouncementHtml(post.body ?? ''),
        }}
      />

      {attachmentDisplay}
      {eventDisplay}
      
      <div className="flex items-center justify-between pt-2 text-xs border-t border-slate-100">
        <span className="text-slate-400">Campus Official Broadcast</span>
        <span className="text-blue-600 font-semibold">
          {isExpanded ? 'Show less ▲' : 'Read more ▼'}
        </span>
      </div>
    </article>
  );
}