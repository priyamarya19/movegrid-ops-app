import FontAwesome from '@expo/vector-icons/FontAwesome';
import * as ImagePicker from 'expo-image-picker';
import { useState } from 'react';
import { ActivityIndicator, Alert, Image, Pressable, Text, View, StyleSheet } from 'react-native';

import { radius, space } from '@/constants/theme';
import { uploadFile, type UploadAsset } from '@/lib/api';
import { useAuth } from '@/lib/auth-context';
import { useTheme } from '@/lib/theme-context';

type Props = {
  label: string;
  folder: string;
  /** S3 key once uploaded (stored in the form state). */
  value: string;
  onChange: (key: string) => void;
};

function assetToUpload(asset: ImagePicker.ImagePickerAsset): UploadAsset {
  const uri = asset.uri;
  const name = asset.fileName ?? uri.split('/').pop() ?? `photo-${Date.now()}.jpg`;
  const type = asset.mimeType ?? 'image/jpeg';
  return { uri, name, type };
}

export function ImageField({ label, folder, value, onChange }: Props) {
  const { token } = useAuth();
  const { t } = useTheme();
  const [uploading, setUploading] = useState(false);
  const [preview, setPreview] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const handleAsset = async (asset: ImagePicker.ImagePickerAsset) => {
    if (!token) return;
    setPreview(asset.uri);
    setError(null);
    setUploading(true);
    try {
      const { key } = await uploadFile(token, assetToUpload(asset), folder);
      onChange(key);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Upload failed');
      setPreview(null);
    } finally {
      setUploading(false);
    }
  };

  const pickFromGallery = async () => {
    const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!perm.granted) {
      Alert.alert('Permission needed', 'Allow photo access to attach images.');
      return;
    }
    const res = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], quality: 0.6 });
    if (!res.canceled && res.assets[0]) handleAsset(res.assets[0]);
  };

  const takePhoto = async () => {
    const perm = await ImagePicker.requestCameraPermissionsAsync();
    if (!perm.granted) {
      Alert.alert('Permission needed', 'Allow camera access to capture images.');
      return;
    }
    const res = await ImagePicker.launchCameraAsync({ quality: 0.6 });
    if (!res.canceled && res.assets[0]) handleAsset(res.assets[0]);
  };

  const clear = () => {
    setPreview(null);
    setError(null);
    onChange('');
  };

  const uploaded = !!value;

  return (
    <View style={styles.field}>
      <Text style={[styles.label, { color: t.textMuted }]}>{label}</Text>

      {uploaded ? (
        <View style={[styles.uploadedRow, { backgroundColor: t.accentSoft, borderColor: t.accent }]}>
          {preview ? <Image source={{ uri: preview }} style={[styles.thumb, { backgroundColor: t.surfaceAlt }]} /> : null}
          <View style={styles.uploadedMain}>
            <FontAwesome name="check-circle" size={14} color={t.accentText} />
            <Text style={[styles.uploadedText, { color: t.accentText }]}>Uploaded</Text>
          </View>
          <Pressable onPress={clear} hitSlop={10} style={styles.clearBtn}>
            <FontAwesome name="times" size={14} color={t.textFaint} />
          </Pressable>
        </View>
      ) : (
        <View style={styles.actions}>
          <Pressable
            style={[styles.actionBtn, { backgroundColor: t.surface, borderColor: t.border }]}
            onPress={pickFromGallery}
            disabled={uploading}>
            <FontAwesome name="image" size={14} color={t.accentText} />
            <Text style={[styles.actionText, { color: t.textMuted }]}>{uploading ? 'Uploading…' : 'Gallery'}</Text>
          </Pressable>
          <Pressable
            style={[styles.actionBtn, { backgroundColor: t.surface, borderColor: t.border }]}
            onPress={takePhoto}
            disabled={uploading}>
            <FontAwesome name="camera" size={14} color={t.accentText} />
            <Text style={[styles.actionText, { color: t.textMuted }]}>Camera</Text>
          </Pressable>
          {uploading ? <ActivityIndicator color={t.accent} style={styles.spinner} /> : null}
        </View>
      )}

      {error ? <Text style={[styles.error, { color: t.dangerText }]}>{error}</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  field: {
    gap: space(1.5),
  },
  label: {
    fontSize: 13,
    fontWeight: '600',
  },
  actions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space(2),
  },
  actionBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: space(2),
    borderWidth: 1,
    borderStyle: 'dashed',
    borderRadius: radius.md,
    paddingVertical: space(3),
  },
  actionText: {
    fontSize: 13,
    fontWeight: '600',
  },
  spinner: {
    marginLeft: space(1),
  },
  uploadedRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space(3),
    borderWidth: 1,
    borderRadius: radius.md,
    padding: space(2.5),
  },
  thumb: {
    width: 40,
    height: 40,
    borderRadius: radius.sm,
  },
  uploadedMain: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: space(2),
  },
  uploadedText: {
    fontSize: 13,
    fontWeight: '600',
  },
  clearBtn: {
    padding: space(1),
  },
  error: {
    fontSize: 12,
  },
});
