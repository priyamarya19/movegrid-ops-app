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
// Replying resolves in one step — the note is what the rider sees in their app,
// so "resolved" with nothing written is worse than leaving it open.
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

  const submit = async (ticket: RiderTicket) => {
    if (!token) return;
    if (note.trim().length < 3) {
      toast('Add a note — the rider reads this', 'error');
      return;
    }
    setSaving(true);
    try {
      await resolveRiderTicket(token, ticket.id, note.trim());
      toast(`Replied to ${ticket.rider_name}`, 'success');
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
            {data?.open ?? 0} open · resolved requests from the last 7 days shown below
          </Text>

          {(data?.tickets ?? []).length === 0 ? (
            <EmptyState icon="comments" message="No support requests." />
          ) : (
            (data?.tickets ?? []).map((x) => {
              const isOpen = x.status === 'open';
              return (
                <View
                  key={x.id}
                  style={[
                    styles.card,
                    { backgroundColor: t.surface, borderColor: isOpen ? t.warning : t.border },
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
                        {isOpen ? (x.age_hours < 1 ? 'just now' : `${x.age_hours}h waiting`) : 'Resolved'}
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

                  {x.resolution_note ? (
                    <View style={[styles.reply, { backgroundColor: t.surfaceAlt }]}>
                      <Text style={[styles.replyLabel, { color: t.textMuted }]}>
                        REPLY{x.resolved_by ? ` · ${x.resolved_by}` : ''}
                      </Text>
                      <Text style={[styles.replyText, { color: t.text }]}>{x.resolution_note}</Text>
                    </View>
                  ) : null}

                  {isOpen ? (
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
                        <View style={{ flexDirection: 'row', gap: space(3) }}>
                          <Pressable
                            onPress={() => submit(x)}
                            disabled={saving}
                            style={[styles.btn, { backgroundColor: t.accent }]}>
                            <Text style={[styles.btnText, { color: t.onAccent }]}>
                              {saving ? 'Saving…' : 'Reply & resolve'}
                            </Text>
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
                        <Text style={[styles.btnText, { color: t.accentText }]}>Reply &amp; resolve</Text>
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
  reply: { borderRadius: radius.md, padding: space(3), gap: 2 },
  replyLabel: { fontSize: 10.5, fontWeight: '700', letterSpacing: 0.5 },
  replyText: { fontSize: 14, lineHeight: 20 },
  input: { borderWidth: 1, borderRadius: radius.md, padding: space(3), minHeight: 72, textAlignVertical: 'top', fontSize: 14 },
  btn: { borderRadius: radius.full, paddingHorizontal: space(4), minHeight: 44, justifyContent: 'center' },
  btnText: { fontSize: 13.5, fontWeight: '800' },
  cancel: { justifyContent: 'center', paddingHorizontal: space(2) },
});
