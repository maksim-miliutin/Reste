import React, { useRef, useState } from 'react';
import { ActivityIndicator, Alert, Pressable, StyleSheet, Text, View } from 'react-native';
import { CameraView, useCameraPermissions } from 'expo-camera';
import * as ImagePicker from 'expo-image-picker';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { matchQuote } from '@/domain/matching';
import { deviceLang, useT } from '@/i18n';
import { parseQuote } from '@/services/ai';
import { useAppStore } from '@/store/useAppStore';
import { Palette, font, radius, spacing, useColors, useThemedStyles } from '@/theme';

export default function Scan() {
  const colors = useColors();
  const styles = useThemedStyles(createStyles);
  const router = useRouter();
  const t = useT(useAppStore((s) => s.lang) ?? deviceLang());

  const [permission, requestPermission] = useCameraPermissions();
  const [busy, setBusy] = useState(false);
  const cameraRef = useRef<CameraView>(null);

  const sector = useAppStore((s) => s.sector);
  const replaceLines = useAppStore((s) => s.replaceLines);

  const handle = async (uri: string) => {
    setBusy(true);
    const res = await parseQuote(uri);
    setBusy(false);

    if (!res.ok) {
      Alert.alert(t(res.reason === 'quota' ? 'scan.quota' : 'scan.failed'));
      return;
    }

    const matched = matchQuote(res.data.lines, sector, new Date().toISOString().slice(0, 10));
    if (matched.length === 0) {
      Alert.alert(t('scan.empty'));
      return;
    }

    replaceLines(
      matched.map((m) => ({
        actCode: m.extracted.code ?? '',
        label: m.extracted.label,
        charged: m.extracted.charged,
        base: m.extracted.base,
        category: m.extracted.category,
        quantity: m.input.quantity ?? 1,
        status: m.status,
        referenceBase: m.referenceBase,
      })),
    );
    // A human always stands between OCR and money.
    router.replace('/review');
  };

  const shoot = async () => {
    const photo = await cameraRef.current?.takePictureAsync({ quality: 0.9 });
    if (photo?.uri) await handle(photo.uri);
  };

  const pick = async () => {
    const res = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], quality: 0.9 });
    if (!res.canceled && res.assets[0]) await handle(res.assets[0].uri);
  };

  if (!permission?.granted) {
    return (
      <SafeAreaView style={styles.screen}>
        <View style={styles.center}>
          <Text style={styles.title}>{t('scan.permTitle')}</Text>
          <Text style={styles.sub}>{t('scan.permSub')}</Text>
          <Pressable style={styles.primary} onPress={requestPermission} accessibilityRole="button">
            <Text style={styles.primaryText}>{t('scan.allow')}</Text>
          </Pressable>
          <Pressable style={styles.ghost} onPress={pick}>
            <Text style={styles.ghostText}>{t('scan.fromLibrary')}</Text>
          </Pressable>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <View style={styles.screen}>
      <CameraView ref={cameraRef} style={StyleSheet.absoluteFill} facing="back" />

      {/* A4 guide frame: helps align the quote and capture all of it */}
      <SafeAreaView style={styles.overlay} edges={['top', 'bottom']}>
        <Text style={styles.hint}>{t('scan.hint')}</Text>
        <View style={styles.frame} />

        <View style={styles.controls}>
          <Pressable onPress={pick} hitSlop={12}>
            <Text style={styles.controlText}>{t('scan.fromLibrary')}</Text>
          </Pressable>

          <Pressable onPress={shoot} disabled={busy} style={styles.shutter} accessibilityRole="button" accessibilityLabel={t('scan.hint')}>
            {busy ? <ActivityIndicator color={colors.bg} /> : <View style={styles.shutterInner} />}
          </Pressable>

          <Pressable onPress={() => router.back()} hitSlop={12}>
            <Text style={styles.controlText}>{t('common.cancel')}</Text>
          </Pressable>
        </View>
      </SafeAreaView>
    </View>
  );
}

const createStyles = (colors: Palette) =>
  StyleSheet.create({
    screen: { flex: 1, backgroundColor: colors.bg },
    center: { flex: 1, justifyContent: 'center', padding: spacing(6) },
    title: { fontFamily: font.display, fontSize: 22, color: colors.text },
    sub: { fontFamily: font.body, fontSize: 14, color: colors.textDim, marginTop: spacing(2), lineHeight: 20 },

    primary: {
      backgroundColor: colors.accent,
      borderRadius: radius.md,
      paddingVertical: spacing(3.5),
      alignItems: 'center',
      marginTop: spacing(6),
    },
    primaryText: { fontFamily: font.med, fontSize: 15, color: '#FFF' },
    ghost: { paddingVertical: spacing(3.5), alignItems: 'center' },
    ghostText: { fontFamily: font.med, fontSize: 14, color: colors.accent },

    overlay: { flex: 1, justifyContent: 'space-between', padding: spacing(5) },
    hint: {
      fontFamily: font.med,
      fontSize: 13,
      color: '#FFF',
      textAlign: 'center',
      backgroundColor: 'rgba(0,0,0,0.45)',
      borderRadius: radius.pill,
      paddingVertical: spacing(2),
      paddingHorizontal: spacing(4),
      overflow: 'hidden',
      alignSelf: 'center',
    },
    frame: {
      flex: 1,
      marginVertical: spacing(5),
      borderWidth: 2,
      borderColor: 'rgba(255,255,255,0.7)',
      borderRadius: radius.md,
      aspectRatio: 0.707, // A4
      alignSelf: 'center',
    },
    controls: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
    controlText: { fontFamily: font.med, fontSize: 14, color: '#FFF' },
    shutter: {
      width: 68,
      height: 68,
      borderRadius: 34,
      borderWidth: 4,
      borderColor: '#FFF',
      alignItems: 'center',
      justifyContent: 'center',
    },
    shutterInner: { width: 52, height: 52, borderRadius: 26, backgroundColor: '#FFF' },
  });
