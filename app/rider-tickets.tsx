import FontAwesome from '@expo/vector-icons/FontAwesome';
import { Stack, useRouter } from 'expo-router';
import { useCallback, useState } from 'react';
import { Image, Linking, Pressable, RefreshControl, ScrollView, Text, TextInput, View, StyleSheet } from 'react-native';

import { EmptyState, ErrorState, LoadingState } from '@/components/ui/QueryStates';
import { useToast } from '@/components/ui/Toast';
import { API_BASE_URL } from '@/constants/config';
import { radius, space } from '@/constants/theme';
import { getRiderTickets, resolveRiderTicket, type RiderTicket } from '@/lib/api';
import { useAuth } from '@/lib/auth-context';
import { formatDate } from '@/lib/format';
import { useTheme } from '@/lib/theme-context';
import { useApiQuery } from '@/lib/useApiQuery';

// Support requests from riders. Open ones first, longest wait at the top.
// Reply and resolve are two decisions, not one. They used to share a single
// button, so every answer closed the ticket — a rider who wrote back had to
// raise a whole new request. The note is mandatory either way: "resolved" with
// nothing written is worse than leaving it open.
export default function RiderTicketsScreen() {
  const { t } = useTheme();
  const { token } = useAuth();
  const toast = useToast();
  const router = useRouter();

  const fetcher = useCallback((tk: string) => getRiderTickets(tk), []);
  const { data, loading, refreshing, error, refetch } = useApiQuery<{ tickets: RiderTicket[]; open: number }>(
    fetcher,
    [],
    { cacheKey: 'rider-tickets' }
  );

  const [replyingId, setReplyingId] = useState<string | null>(null);
  const [note, setNote] = useState('');
  const [saving, setSaving] = useState(false);

  const submit = async (ticket: RiderTicket, action: 'reply' | 'resolve' | 'request_close') => {
    if (!token) return;
    if (note.trim().length < 3) {
      toast('Add a note — the rider reads this', 'error');
      return;
    }
    setSaving(true);
    try {
      await resolveRiderTicket(token, ticket.id, note.trim(), action);
      toast(
        action === 'resolve'
          ? `Closed · ${ticket.rider_name} notified`
          : action === 'request_close'
            ? `Asked ${ticket.rider_name} — closes when they say yes`
            : `Replied to ${ticket.rider_name} — still open`,
        'success'
      );
      setReplyingId(null);
      setNote('');
      refetch();
    } catch (e) {
      toast(e instanceof Error ? e.message : 'Could not resolve this', 'error');
    } finally {
      setSaving(false);
    }
  };

  const mediaUrl = (key: string) => `${API_BASE_URL}/api/file?key=${encodeURIComponent(key)}`;

  return (
    <>
      <Stack.Screen options={{ title: 'Rider support', headerBackTitle: 'Back' }} />
      {loading ? (
        <LoadingState label="Loading requests…" />
      ) : error ? (
        <ErrorState message={error} onRetry={refetch} />
      ) : (
        <ScrollView
          style={{ flex: 1, backgroundColor: t.bg }}
          contentContainerStyle={styles.content}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={refetch} tintColor={t.accent} />}>
          <Text style={[styles.summary, { color: t.textMuted }]}>
            {data?.open ?? 0} needing attention · closed requests from the last 7 days shown below
          </Text>

          {(data?.tickets ?? []).length === 0 ? (
            <EmptyState icon="comments" message="No support requests." />
          ) : (
            (data?.tickets ?? []).map((x) => {
              const isOpen = x.status === 'open';
              // Waiting on the rider's yes/no is not off our plate either — it
              // just isn't ours to act on until they answer.
              const waiting = x.status === 'pending_closure';
              const live = x.status !== 'resolved';
              return (
                <View
                  key={x.id}
                  style={[
                    styles.card,
                    { backgroundColor: t.surface, borderColor: isOpen ? t.warning : waiting ? t.accent : t.border },
                  ]}>
                  <View style={styles.head}>
                    <Pressable
                      onPress={() => router.push({ pathname: '/rider/[id]', params: { id: x.rider_id } })}
                      style={{ flex: 1 }}>
                      <Text style={[styles.rider, { color: t.accentText }]}>{x.rider_name}</Text>
                      <Text style={[styles.meta, { color: t.textFaint }]}>
                        {x.rider_code ?? '—'} · {x.mobile}
                        {x.ev_number ? ` · ${x.ev_number}` : ''}
                      </Text>
                    </Pressable>
                    <View
                      style={[
                        styles.pill,
                        {
                          backgroundColor: isOpen
                            ? x.age_hours >= 24
                              ? t.dangerSoft
                              : t.warningSoft
                            : t.accentSoft,
                        },
                      ]}>
                      <Text
                        style={[
                          styles.pillText,
                          {
                            color: isOpen
                              ? x.age_hours >= 24
                                ? t.dangerText
                                : t.warningText
                              : t.accentText,
                          },
                        ]}>
                        {isOpen
                          ? x.age_hours < 1
                            ? 'just now'
                            : `${x.age_hours}h waiting`
                          : waiting
                            ? 'Waiting on rider'
                            : 'Resolved'}
                      </Text>
                    </View>
                  </View>

                  <Text style={[styles.message, { color: t.text }]}>{x.message}</Text>
                  <Text style={[styles.meta, { color: t.textFaint }]}>{formatDate(x.created_at)}</Text>

                  {x.media_url ? (
                    x.media_type === 'video' ? (
                      <Pressable
                        onPress={() => Linking.openURL(mediaUrl(x.media_url!))}
                        style={[styles.videoLink, { borderColor: t.border }]}>
                        <FontAwesome name="video-camera" size={14} color={t.accentText} />
                        <Text style={[styles.videoLinkText, { color: t.accentText }]}>Play the clip</Text>
                      </Pressable>
                    ) : (
                      <Pressable onPress={() => Linking.openURL(mediaUrl(x.media_url!))}>
                        <Image source={{ uri: mediaUrl(x.media_url) }} style={styles.photo} resizeMode="cover" />
                      </Pressable>
                    )
                  ) : null}

                  {/* The rest of the conversation. The rider's opening message
                      is already shown above, so it is skipped here. */}
                  {(x.messages ?? []).slice(1).map((m) =>
                    m.kind !== 'message' ? (
                      <Text key={m.id} style={[styles.event, { color: t.textFaint }]}>
                        {m.kind === 'close_request'
                          ? `${m.author_name ?? 'Ops'} asked to close this`
                          : m.kind === 'close_approved'
                            ? 'Rider confirmed it is sorted'
                            : m.kind === 'close_declined'
                              ? 'Rider said it is not sorted yet'
                              : 'Closed automatically — no reply'}
                        {m.body ? ` — “${m.body}”` : ''}
                      </Text>
                    ) : (
                      <View
                        key={m.id}
                        style={[
                          styles.reply,
                          {
                            backgroundColor: m.author === 'ops' ? t.accentSoft : t.surfaceAlt,
                            alignSelf: m.author === 'ops' ? 'flex-end' : 'flex-start',
                          },
                        ]}>
                        <Text style={[styles.replyLabel, { color: t.textMuted }]}>
                          {m.author === 'ops' ? (m.author_name ?? 'Ops') : x.rider_name}
                        </Text>
                        <Text style={[styles.replyText, { color: t.text }]}>{m.body}</Text>
                      </View>
                    )
                  )}

                  {live ? (
                    replyingId === x.id ? (
                      <View style={{ gap: space(2) }}>
                        <TextInput
                          value={note}
                          onChangeText={setNote}
                          multiline
                          autoFocus
                          placeholder="What did you do about it?"
                          placeholderTextColor={t.textFaint}
                          style={[
                            styles.input,
                            { backgroundColor: t.bg, borderColor: t.border, color: t.text },
                          ]}
                        />
                        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: space(2) }}>
                          <Pressable
                            onPress={() => submit(x, 'reply')}
                            disabled={saving}
                            style={[styles.btn, { backgroundColor: t.accent }]}>
                            <Text style={[styles.btnText, { color: t.onAccent }]}>
                              {saving ? 'Sending…' : 'Send reply'}
                            </Text>
                          </Pressable>
                          {/* Closing is the rider's word. "Close now" stays for
                              duplicates and riders who have gone for good. */}
                          <Pressable
                            onPress={() => submit(x, 'request_close')}
                            disabled={saving}
                            style={[styles.btn, { backgroundColor: t.accentSoft }]}>
                            <Text style={[styles.btnText, { color: t.accentText }]}>Ask to close</Text>
                          </Pressable>
                          <Pressable
                            onPress={() => submit(x, 'resolve')}
                            disabled={saving}
                            style={[styles.btn, { borderWidth: 1, borderColor: t.border }]}>
                            <Text style={[styles.btnText, { color: t.textMuted }]}>Close now</Text>
                          </Pressable>
                          <Pressable
                            onPress={() => {
                              setReplyingId(null);
                              setNote('');
                            }}
                            style={styles.cancel}>
                            <Text style={{ color: t.textMuted, fontSize: 13 }}>Cancel</Text>
                          </Pressable>
                        </View>
                      </View>
                    ) : (
                      <Pressable
                        onPress={() => {
                          setReplyingId(x.id);
                          setNote('');
                        }}
                        style={[styles.btn, { backgroundColor: t.accentSoft, alignSelf: 'flex-start' }]}>
                        <Text style={[styles.btnText, { color: t.accentText }]}>Reply</Text>
                      </Pressable>
                    )
                  ) : null}
                </View>
              );
            })
          )}
        </ScrollView>
      )}
    </>
  );
}

const styles = StyleSheet.create({
  content: { padding: space(4), gap: space(3), paddingBottom: space(10) },
  summary: { fontSize: 13 },
  card: { borderWidth: 1, borderRadius: radius.xl, padding: space(4), gap: space(2.5) },
  head: { flexDirection: 'row', alignItems: 'flex-start', gap: space(3) },
  rider: { fontSize: 15, fontWeight: '700' },
  meta: { fontSize: 12 },
  pill: { borderRadius: radius.full, paddingHorizontal: space(2.5), paddingVertical: 3 },
  pillText: { fontSize: 11, fontWeight: '800' },
  message: { fontSize: 15, lineHeight: 21 },
  photo: { width: '100%', height: 200, borderRadius: radius.lg },
  videoLink: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space(2),
    borderWidth: 1,
    borderRadius: radius.lg,
    paddingVertical: space(3),
    justifyContent: 'center',
    minHeight: 44,
  },
  videoLinkText: { fontSize: 13, fontWeight: '700' },
  reply: { borderRadius: radius.md, padding: space(3), gap: 2, maxWidth: '88%' },
  event: { fontSize: 11, textAlign: 'center', paddingVertical: space(1) },
  replyLabel: { fontSize: 10.5, fontWeight: '700', letterSpacing: 0.5 },
  replyText: { fontSize: 14, lineHeight: 20 },
  input: { borderWidth: 1, borderRadius: radius.md, padding: space(3), minHeight: 72, textAlignVertical: 'top', fontSize: 14 },
  btn: { borderRadius: radius.full, paddingHorizontal: space(4), minHeight: 44, justifyContent: 'center' },
  btnText: { fontSize: 13.5, fontWeight: '800' },
  cancel: { justifyContent: 'center', paddingHorizontal: space(2) },
});
