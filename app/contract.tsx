import React, { useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Coverage } from '@/domain/reimbursement';
import { CareCategory } from '@/domain/tariffs';
import { deviceLang, useT } from '@/i18n';
import { CATEGORIES, describeCoverage, parseContract } from '@/services/ai';
import { useAppStore } from '@/store/useAppStore';
import { Palette, font, radius, spacing, useColors, useThemedStyles } from '@/theme';

/** Common cover levels — faster than typing percentages by hand. */
const LEVELS: { label: string; value: Coverage }[] = [
  { label: '—', value: { kind: 'none' } },
  { label: '100 %', value: { kind: 'percentOfBase', percent: 100 } },
  { label: '150 %', value: { kind: 'percentOfBase', percent: 150 } },
  { label: '200 %', value: { kind: 'percentOfBase', percent: 200 } },
  { label: '300 %', value: { kind: 'percentOfBase', percent: 300 } },
];

export default function Contract() {
  const colors = useColors();
  const styles = useThemedStyles(createStyles);
  const router = useRouter();
  const t = useT(useAppStore((s) => s.lang) ?? deviceLang());

  const contract = useAppStore((s) => s.contract);
  const setContract = useAppStore((s) => s.setContract);
  const setCeiling = useAppStore((s) => s.setCeiling);
  const [busy, setBusy] = useState(false);

  const scan = async () => {
    const picked = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], quality: 0.9 });
    if (picked.canceled || !picked.assets[0]) return;

    setBusy(true);
    const res = await parseContract(picked.assets[0].uri);
    setBusy(false);

    if (!res.ok) {
      Alert.alert(t('contract.failed'));
      return;
    }
    setContract(res.data);
  };

  const setLevel = (category: CareCategory, value: Coverage) => {
    const base = contract ?? { name: t('contract.custom'), responsible: true, coverage: {} };
    setContract({ ...base, coverage: { ...base.coverage, [category]: value } });
  };

  const current = (c: CareCategory) => contract?.coverage[c];

  return (
    <SafeAreaView style={styles.screen} edges={['top', 'left', 'right']}>
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <Text style={styles.title}>{t('contract.title')}</Text>
        <Text style={styles.sub}>{t('contract.sub')}</Text>

        <Pressable style={styles.primary} onPress={scan} disabled={busy} accessibilityRole="button">
          {busy ? (
            <ActivityIndicator color="#FFF" />
          ) : (
            <Text style={styles.primaryText}>{t('contract.scan')}</Text>
          )}
        </Pressable>

        {contract && (
          <View style={styles.badge}>
            <Text style={styles.badgeText}>{contract.name || t('contract.custom')}</Text>
          </View>
        )}

        <Text style={styles.section}>{t('contract.manual')}</Text>
        <Text style={styles.sectionHint}>{t('contract.ceilingHint')}</Text>

        {CATEGORIES.map((category) => (
          <View key={category} style={styles.row}>
            <View style={styles.rowHead}>
              <Text style={styles.rowLabel}>{t(`category.${category}`)}</Text>
              <Text style={styles.rowValue}>{describeCoverage(current(category))}</Text>
            </View>
            <View style={styles.levels}>
              {LEVELS.map((lvl) => {
                const active =
                  describeCoverage(current(category)) === describeCoverage(lvl.value);
                return (
                  <Pressable
                    key={lvl.label}
                    onPress={() => setLevel(category, lvl.value)}
                    style={[styles.chip, active && { backgroundColor: colors.accent }]}
                  >
                    <Text style={[styles.chipText, active && { color: '#FFF' }]}>{lvl.label}</Text>
                  </Pressable>
                );
              })}
            </View>

            {/* Flat amount and annual cap: missing from the chips, present in
                almost every real contract — optical is priced in euros per act,
                and a generous percentage is capped in a footnote. */}
            <View style={styles.numbers}>
              <EuroField
                placeholder={t('contract.flatPh')}
                value={
                  current(category)?.kind === 'flatEuro'
                    ? String((current(category) as { amount: number }).amount)
                    : ''
                }
                onCommit={(v) =>
                  setLevel(category, v === undefined ? { kind: 'none' } : { kind: 'flatEuro', amount: v })
                }
                styles={styles}
                colors={colors}
              />
              <EuroField
                placeholder={t('contract.ceilingPh')}
                value={
                  contract?.annualCeiling?.[category] !== undefined
                    ? String(contract.annualCeiling[category])
                    : ''
                }
                onCommit={(v) => setCeiling(category, v)}
                styles={styles}
                colors={colors}
              />
            </View>
          </View>
        ))}

        {contract?.annualCeiling && Object.keys(contract.annualCeiling).length > 0 && (
          <Pressable style={styles.ceilingLink} onPress={() => router.push('/ledger')} accessibilityRole="button">
            <Text style={styles.ceilingLinkText}>{t('contract.ceilings')}</Text>
          </Pressable>
        )}

        <Text style={styles.note}>{t('contract.note')}</Text>

        <Pressable style={styles.done} onPress={() => router.back()} accessibilityRole="button">
          <Text style={styles.doneText}>{t('common.done')}</Text>
        </Pressable>
      </ScrollView>
    </SafeAreaView>
  );
}

/** Euro amount field: empty means "not set". */
const EuroField: React.FC<{
  placeholder: string;
  value: string;
  onCommit: (v: number | undefined) => void;
  styles: ReturnType<typeof createStyles>;
  colors: Palette;
}> = ({ placeholder, value, onCommit, styles, colors }) => {
  const [text, setText] = useState(value);

  return (
    <TextInput
      style={styles.euro}
      value={text}
      onChangeText={setText}
      onBlur={() => {
        const n = Number(text.replace(',', '.'));
        onCommit(text.trim() === '' || !Number.isFinite(n) || n <= 0 ? undefined : n);
      }}
      placeholder={placeholder}
      placeholderTextColor={colors.textFaint}
      keyboardType="decimal-pad"
      maxLength={6}
      accessibilityLabel={placeholder}
    />
  );
};

const createStyles = (colors: Palette) =>
  StyleSheet.create({
    screen: { flex: 1, backgroundColor: colors.bg },
    content: { padding: spacing(5), paddingBottom: spacing(12) },

    title: { fontFamily: font.display, fontSize: 24, color: colors.text },
    sub: { fontFamily: font.body, fontSize: 14, color: colors.textDim, marginTop: spacing(2), lineHeight: 20 },

    primary: {
      backgroundColor: colors.accent,
      borderRadius: radius.md,
      paddingVertical: spacing(3.5),
      alignItems: 'center',
      marginTop: spacing(5),
    },
    primaryText: { fontFamily: font.med, fontSize: 15, color: '#FFF' },

    badge: {
      backgroundColor: colors.accentSoft,
      borderRadius: radius.sm,
      paddingVertical: spacing(2),
      paddingHorizontal: spacing(3),
      marginTop: spacing(3),
      alignSelf: 'flex-start',
    },
    badgeText: { fontFamily: font.med, fontSize: 13, color: colors.accentDeep },

    section: {
      fontFamily: font.med,
      fontSize: 12,
      letterSpacing: 0.8,
      textTransform: 'uppercase',
      color: colors.textFaint,
      marginTop: spacing(7),
      marginBottom: spacing(2),
    },
    sectionHint: {
      fontFamily: font.body,
      fontSize: 11,
      color: colors.textDim,
      lineHeight: 16,
      marginBottom: spacing(3),
    },

    row: {
      backgroundColor: colors.surface,
      borderRadius: radius.md,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: colors.line,
      padding: spacing(4),
      marginTop: spacing(2),
    },
    rowHead: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline' },
    rowLabel: { fontFamily: font.med, fontSize: 14, color: colors.text },
    rowValue: { fontFamily: font.body, fontSize: 13, color: colors.textDim },
    levels: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing(2), marginTop: spacing(3) },
    numbers: { flexDirection: 'row', gap: spacing(2), marginTop: spacing(2) },
    euro: {
      flex: 1,
      backgroundColor: colors.surfaceAlt,
      borderRadius: radius.sm,
      paddingHorizontal: spacing(3),
      paddingVertical: spacing(2),
      fontFamily: font.med,
      fontSize: 13,
      color: colors.text,
    },
    chip: {
      backgroundColor: colors.surfaceAlt,
      borderRadius: radius.pill,
      paddingVertical: spacing(1.5),
      paddingHorizontal: spacing(3),
    },
    chipText: { fontFamily: font.med, fontSize: 12, color: colors.textDim },

    ceilingLink: {
      backgroundColor: colors.surfaceAlt,
      borderRadius: radius.md,
      paddingVertical: spacing(3),
      alignItems: 'center',
      marginTop: spacing(5),
    },
    ceilingLinkText: { fontFamily: font.med, fontSize: 14, color: colors.accentDeep },
    note: {
      fontFamily: font.body,
      fontSize: 11,
      color: colors.textFaint,
      marginTop: spacing(5),
      lineHeight: 16,
    },
    done: {
      marginTop: spacing(5),
      borderRadius: radius.md,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: colors.accent,
      paddingVertical: spacing(3),
      alignItems: 'center',
    },
    doneText: { fontFamily: font.med, fontSize: 14, color: colors.accent },
  });
