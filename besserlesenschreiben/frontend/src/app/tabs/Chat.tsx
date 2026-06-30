import { type FormEvent, useEffect, useRef, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Send } from 'lucide-react';
import { chatApi } from '@/lib/endpoints';
import type { ChatHistory, ChatMessage } from '@/lib/types';
import { useActiveProfile } from '@/features/profile/useMe';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/cn';

/**
 * Trainer chat ("Angelika") — a free AI feature. Sends the child's message and shows the trainer's reply.
 * Optimistic: the child's bubble appears immediately; the reply lands when the backend responds.
 */
export function Chat() {
  const profile = useActiveProfile();
  const profileId = profile?.id;
  const qc = useQueryClient();
  const [draft, setDraft] = useState('');
  const endRef = useRef<HTMLDivElement>(null);

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
      // drop the optimistic message back to the server's truth
      void qc.invalidateQueries({ queryKey: key });
    },
  });

  // Keep the latest message in view.
  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages.length, send.isPending]);

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
        <div className="flex h-11 w-11 items-center justify-center rounded-full bg-teal/15 text-2xl" aria-hidden>
          👩‍🏫
        </div>
        <div>
          <h1 className="font-display text-xl font-bold text-ink">Angelika</h1>
          <p className="text-sm text-ink-soft">Deine Lese-Trainerin</p>
        </div>
      </header>

      <div className="flex-1 space-y-3 overflow-y-auto pb-4">
        {isPending && <p className="py-6 text-center text-sm text-ink-soft">Lädt …</p>}
        {!isPending && messages.length === 0 && (
          <p className="mx-auto mt-8 max-w-xs text-center text-ink-soft">
            Schreib Angelika eine Nachricht – frag etwas über Buchstaben, Silben oder Reime! ✏️
          </p>
        )}
        {messages.map((m, i) => (
          <Bubble key={`${m.ts}-${i}`} message={m} />
        ))}
        {send.isPending && (
          <div className="flex justify-start">
            <div className="rounded-2xl rounded-bl-sm bg-white px-4 py-2 text-ink-soft shadow-sm ring-1 ring-black/5">
              Angelika schreibt …
            </div>
          </div>
        )}
        <div ref={endRef} />
      </div>

      <form onSubmit={onSubmit} className="sticky bottom-0 flex gap-2 bg-canvas/80 py-3 backdrop-blur">
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
          'max-w-[80%] whitespace-pre-wrap rounded-2xl px-4 py-2 shadow-sm',
          message.me
            ? 'rounded-br-sm bg-teal text-white'
            : 'rounded-bl-sm bg-white text-ink ring-1 ring-black/5',
        )}
      >
        {message.text}
      </div>
    </div>
  );
}
