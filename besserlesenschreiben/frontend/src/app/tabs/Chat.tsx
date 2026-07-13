import { type ChangeEvent, type FormEvent, useEffect, useRef, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { Camera, Send, Sparkles } from 'lucide-react';
import { chatApi, homeworkApi } from '@/lib/endpoints';
import { errorMessage } from '@/lib/api';
import type { ChatHistory, ChatMessage } from '@/lib/types';
import { useActiveProfile } from '@/features/profile/useMe';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/cn';

const TERMINAL = new Set(['reviewed', 'rejected']);

/**
 * Trainer chat ("Angelika") — a free AI feature. Sends the child's message and shows the trainer's reply.
 * Also the entry point for homework "Foto & verbessern": a photo uploads here and the backend surfaces it
 * (plus its review status) as durable chat bubbles in /chat history — so it persists across reloads.
 */
export function Chat() {
  const profile = useActiveProfile();
  const profileId = profile?.id;
  const qc = useQueryClient();
  const [draft, setDraft] = useState('');
  const endRef = useRef<HTMLDivElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const key = ['chat', profileId] as const;
  const { data, isPending } = useQuery({
    queryKey: key,
    queryFn: () => chatApi.history(profileId as string),
    enabled: Boolean(profileId),
  });
  const messages = data?.messages ?? [];

  const send = useMutation({
    mutationFn: (text: string) => chatApi.send(profileId as string, text),
    onMutate: async (text): Promise<void> => {
      await qc.cancelQueries({ queryKey: key });
      const optimistic: ChatMessage = { me: true, text, ts: new Date().toISOString() };
      qc.setQueryData<ChatHistory>(key, (prev) => ({ messages: [...(prev?.messages ?? []), optimistic] }));
    },
    onSuccess: (res) => {
      qc.setQueryData<ChatHistory>(key, (prev) => ({ messages: [...(prev?.messages ?? []), res.reply] }));
    },
    onError: () => {
      void qc.invalidateQueries({ queryKey: key });
    },
  });

  // ── Homework upload — the photo + its status are served back as chat bubbles by /chat history ──
  const upload = useMutation({ mutationFn: (file: File) => homeworkApi.upload(profileId as string, file) });
  const uploadId = upload.data?.uploadId ?? null; // derived — the mutation result IS the source of truth

  const hwStatus = useQuery({
    queryKey: ['homework', uploadId],
    queryFn: () => homeworkApi.status(uploadId as string),
    enabled: Boolean(uploadId),
    // Human review is slow (minutes+): back off rather than hammer. react-query pauses this in the
    // background by default, and refetches on focus — so the verdict still lands without a fast poll.
    refetchInterval: (q) => (!q.state.data || TERMINAL.has(q.state.data.status) ? false : 20_000),
  });

  // Refresh the chat bubble on each NEW status (photo appears → in review → verdict), once per transition.
  const lastStatus = useRef<string | null>(null);
  useEffect(() => {
    const s = hwStatus.data?.status;
    if (!s || s === lastStatus.current) return;
    lastStatus.current = s;
    void qc.invalidateQueries({ queryKey: ['chat', profileId] });
  }, [hwStatus.data?.status, profileId, qc]);

  const onPickPhoto = (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = ''; // allow re-picking the same file
    if (!file || !profileId || upload.isPending) return;
    lastStatus.current = null; // a new upload → let its status transitions refresh the chat again
    upload.reset(); // clear any prior error banner
    upload.mutate(file);
  };

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages.length, send.isPending, upload.isPending]);

  const onSubmit = (e: FormEvent) => {
    e.preventDefault();
    const text = draft.trim();
    if (!text || send.isPending) return;
    setDraft('');
    send.mutate(text);
  };

  return (
    <section className="flex min-h-[calc(100dvh-8rem)] flex-col">
      <header className="flex items-center gap-3 pb-3">
        <img
          src="/angelika.svg"
          alt=""
          aria-hidden
          className="h-11 w-11 rounded-full bg-teal/15 object-contain"
        />
        <div>
          <h1 className="font-display text-xl font-bold text-ink">Angelika</h1>
          <p className="text-sm text-ink-soft">Deine Lese-Trainerin</p>
        </div>
      </header>

      <div className="flex-1 space-y-3 overflow-y-auto pb-4">
        {isPending && <p className="py-6 text-center text-sm text-ink-soft">Lädt …</p>}
        {!isPending && messages.length === 0 && (
          <p className="mx-auto mt-8 max-w-xs text-center text-ink-soft">
            Schreib Angelika eine Nachricht – oder lade ein Foto deiner Hausübung, Test oder Schularbeit hoch
            und hol dir die nächste Übung.
          </p>
        )}
        {messages.map((m, i) => (
          <Bubble key={`${m.ts}-${i}`} message={m} />
        ))}
        {(send.isPending || upload.isPending) && (
          <div className="flex justify-start">
            <div className="rounded-2xl rounded-bl-sm bg-white px-4 py-2 text-ink-soft shadow-sm ring-1 ring-black/5">
              {upload.isPending ? 'Foto wird hochgeladen …' : 'Angelika schreibt …'}
            </div>
          </div>
        )}
        <div ref={endRef} />
      </div>

      {upload.isError && (
        <p role="alert" className="pb-2 text-center text-sm text-orange-dark">
          {errorMessage(upload.error)}
        </p>
      )}

      <form onSubmit={onSubmit} className="sticky bottom-0 flex gap-2 bg-canvas/80 py-3 backdrop-blur">
        <input
          ref={fileRef}
          type="file"
          accept="image/*"
          capture="environment"
          onChange={onPickPhoto}
          className="hidden"
        />
        <Button
          type="button"
          variant="ghost"
          size="md"
          aria-label="Hausübung fotografieren"
          title="Hausübung hochladen – eine Fachkraft schaut sie sich an"
          onClick={() => fileRef.current?.click()}
          disabled={upload.isPending || !profileId}
        >
          <Camera className="h-5 w-5" aria-hidden />
        </Button>
        <input
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          placeholder="Nachricht an Angelika …"
          aria-label="Nachricht"
          maxLength={1000}
          className="flex-1 rounded-2xl bg-white px-4 py-3 text-ink shadow-sm ring-1 ring-black/5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal/60"
        />
        <Button type="submit" size="md" aria-label="Senden" disabled={!draft.trim() || send.isPending}>
          <Send className="h-5 w-5" aria-hidden />
        </Button>
      </form>
    </section>
  );
}

function Bubble({ message }: { message: ChatMessage }) {
  return (
    <div className={cn('flex', message.me ? 'justify-end' : 'justify-start')}>
      <div
        className={cn(
          'max-w-[80%] rounded-2xl shadow-sm',
          message.me ? 'rounded-br-sm bg-teal text-white' : 'rounded-bl-sm bg-white text-ink ring-1 ring-black/5',
          message.imageUrl ? 'overflow-hidden p-1' : 'whitespace-pre-wrap px-4 py-2',
        )}
      >
        {message.imageUrl ? (
          <img src={message.imageUrl} alt="Hausübung" className="max-h-64 rounded-xl object-contain" />
        ) : (
          <>
            {message.text}
            {message.homeworkStatus === 'reviewed' && (
              // Reviewed verdict → take the child straight to where the adapted exercises live
              // (the ✨ entry on /lernen). Navigation only — generating the lecture stays a
              // deliberate tap there (it consumes a daily ★ session).
              <Link
                to="/app/lernen"
                className="mt-2 flex w-fit items-center gap-1.5 rounded-full bg-teal px-3.5 py-1.5 text-sm font-semibold text-white shadow-sm transition-transform active:scale-95"
              >
                <Sparkles className="h-4 w-4" aria-hidden />
                Zu deinen neuen Übungen
              </Link>
            )}
          </>
        )}
      </div>
    </div>
  );
}
