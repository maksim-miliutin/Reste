import React, { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { ceilingResetDate, ceilingYearStart } from '@/domain/ceilings';
import { CareCategory } from '@/domain/tariffs';
import { deviceLang, useT } from '@/i18n';
import { CATEGORIES } from '@/services/ai';
import { useAppStore } from '@/store/useAppStore';
import { Palette, font, radius, spacing, useColors, useThemedStyles } from '@/theme';

/** Short month names in the device locale. */
const MONTHS = Array.from({ length: 12 }, (_, i) =>
  new Date(2026, i, 1).toLocaleDateString(undefined, { month: 'short' }),
);

const euro = (n: number) =>
  new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR' }).format(n);

/**
 * What the insurer has already paid this year.
 *
 * Required for the annual caps to work at all: without these records the app
 * assumes an untouched limit and promises more than will arrive. Filled in by
 * hand from statements — there is nowhere to pull this data from.
 */
export default function Ledger() {
  const colors = useColors();
  const styles = useThemedStyles(createStyles);
  const router = useRouter();
  const t = useT(useAppStore((s) => s.lang) ?? deviceLang());

  const contract = useAppStore((s) => s.contract);
  const ledger = useAppStore((s) => s.ledger);
  const addToLedger = useAppStore((s) => s.addToLedger);
  const removeFromLedger = useAppStore((s) => s.removeFromLedger);
  const consumed = useAppStore((s) => s.consumedThisYear)();
  const setContract = useAppStore((s) => s.setContract);

  const [category, setCategory] = useState<CareCategory>('dental');
  const [amount, setAmount] = useState('');
  const [label, setLabel] = useState('');

  // The cap window comes from the contract: not all start on 1 January.
  const from = ceilingYearStart(contract);
  const resetOn = ceilingResetDate(contract);
  const thisPeriod = ledger.filter((e) => e.date >= from);

  const add = () => {
    const value = Number(amount.replace(',', '.'));
    if (!Number.isFinite(value) || value <= 0) return;
    addToLedger({ category, amount: Math.round(value * 100) / 100, label: label.trim() || t(`category.${category}`) });
    setAmount('');
    setLabel('');
  };

  /** Only categories where the contract set a cap are relevant. */
  const capped = CATEGORIES.filter((c) => contract?.annualCeiling?.[c] !== undefined);

  return (
    <SafeAreaView style={styles.screen} edges={['top', 'left', 'right']}>
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <Text style={styles.title}>{t('ledger.title')}</Text>
        <Text style={styles.sub}>{t('ledger.sub', { date: resetOn })}</Text>

        {capped.length > 0 && (
          <View style={styles.ceilings}>
            {capped.map((c) => {
              const ceiling = contract!.annualCeiling![c]!;
              const used = consumed[c] ?? 0;
              const left = Math.max(0, ceiling - used);
              const pct = Math.min(100, (used / ceiling) * 100);
              return (
                <View key={c} style={styles.ceilingRow}>
                  <View style={styles.ceilingHead}>
                    <Text style={styles.ceilingLabel}>{t(`category.${c}`)}</Text>
                    <Text style={[styles.ceilingLeft, left === 0 && { color: colors.danger }]}>
                      {t('ledger.left', { n: euro(left) })}
                    </Text>
                  </View>
                  <View style={styles.track}>
                    <View
                      style={[
                        styles.fill,
                        { width: `${pct}%`, backgroundColor: left === 0 ? colors.danger : colors.accent },
                      ]}
                    />
                  </View>
                  <Text style={styles.ceilingNote}>
                    {t('ledger.usedOf', { used: euro(used), ceiling: euro(ceiling) })}
                  </Text>
                </View>
              );
            })}
          </View>
        )}

        {contract && (
          <View style={styles.periodBox}>
            <Text style={styles.periodLabel}>{t('ledger.periodStart')}</Text>
            <Text style={styles.periodHint}>{t('ledger.periodHint')}</Text>
            <View style={styles.months}>
              {MONTHS.map((m, i) => {
                const value = `${String(i + 1).padStart(2, '0')}-01`;
                const active = (contract.ceilingYearStart ?? '01-01') === value;
                return (
                  <Pressable
                    key={m}
                    onPress={() => setContract({ ...contract, ceilingYearStart: value })}
                    style={[styles.month, active && { backgroundColor: colors.accent }]}
                    accessibilityRole="radio"
                  >
                    <Text style={[styles.monthText, active && { color: '#FFF' }]}>{m}</Text>
                  </Pressable>
                );
              })}
            </View>
          </View>
        )}

        <Text style={styles.section}>{t('ledger.add')}</Text>

        <View style={styles.chips}>
          {CATEGORIES.map((c) => (
            <Pressable
              key={c}
              onPress={() => setCategory(c)}
              style={[styles.chip, category === c && { backgroundColor: colors.accent }]} accessibilityRole="radio"
            >
              <Text style={[styles.chipText, category === c && { color: '#FFF' }]}>
                {t(`category.${c}`)}
              </Text>
            </Pressable>
          ))}
        </View>

        <View style={styles.form}>
          <TextInput
            style={[styles.input, { flex: 1 }]}
            value={label}
            onChangeText={setLabel}
            placeholder={t('ledger.labelPh')}
            placeholderTextColor={colors.textFaint}
            maxLength={40}
          />
          <TextInput
            style={[styles.input, { width: 96 }]}
            value={amount}
            onChangeText={setAmount}
            placeholder="0"
            placeholderTextColor={colors.textFaint}
            keyboardType="decimal-pad"
            maxLength={7}
          />
          <Pressable onPress={add} style={styles.addBtn} accessibilityRole="button" accessibilityLabel={t('ledger.add')}>
            <Text style={styles.addBtnText}>+</Text>
          </Pressable>
        </View>

        {thisPeriod.length === 0 ? (
          <Text style={styles.empty}>{t('ledger.empty')}</Text>
        ) : (
          thisPeriod.map((e) => (
            <Pressable key={e.id} onLongPress={() => removeFromLedger(e.id)} style={styles.entry}>
              <View style={{ flex: 1 }}>
                <Text style={styles.entryLabel}>{e.label}</Text>
                <Text style={styles.entryCat}>{t(`category.${e.category}`)}</Text>
              </View>
              <Text style={styles.entryAmount}>{euro(e.amount)}</Text>
            </Pressable>
          ))
        )}

        <Text style={styles.note}>{t('ledger.note')}</Text>

        <Pressable style={styles.done} onPress={() => router.back()} accessibilityRole="button">
          <Text style={styles.doneText}>{t('common.done')}</Text>
        </Pressable>
      </ScrollView>
    </SafeAreaView>
  );
}

const createStyles = (colors: Palette) =>
  StyleSheet.create({
    screen: { flex: 1, backgroundColor: colors.bg },
    content: { padding: spacing(5), paddingBottom: spacing(12) },
    title: { fontFamily: font.display, fontSize: 24, color: colors.text },
    sub: { fontFamily: font.body, fontSize: 14, color: colors.textDim, marginTop: spacing(2), lineHeight: 20 },

    ceilings: { marginTop: spacing(5), gap: spacing(4) },
    ceilingRow: {
      backgroundColor: colors.surface,
      borderRadius: radius.md,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: colors.line,
      padding: spacing(4),
    },
    ceilingHead: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline' },
    ceilingLabel: { fontFamily: font.med, fontSize: 14, color: colors.text },
    ceilingLeft: { fontFamily: font.display, fontSize: 14, color: colors.accentDeep },
    track: { height: 6, borderRadius: radius.pill, backgroundColor: colors.surfaceAlt, marginTop: spacing(3), overflow: 'hidden' },
    fill: { height: '100%', borderRadius: radius.pill },
    ceilingNote: { fontFamily: font.body, fontSize: 11, color: colors.textDim, marginTop: spacing(2) },

    periodBox: {
      backgroundColor: colors.surface,
      borderRadius: radius.md,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: colors.line,
      padding: spacing(4),
      marginTop: spacing(5),
    },
    periodLabel: { fontFamily: font.med, fontSize: 14, color: colors.text },
    periodHint: { fontFamily: font.body, fontSize: 11, color: colors.textDim, marginTop: 2, lineHeight: 16 },
    months: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing(1.5), marginTop: spacing(3) },
    month: {
      backgroundColor: colors.surfaceAlt,
      borderRadius: radius.sm,
      paddingVertical: spacing(1.5),
      paddingHorizontal: spacing(2.5),
    },
    monthText: { fontFamily: font.med, fontSize: 11, color: colors.textDim },
    section: {
      fontFamily: font.med,
      fontSize: 12,
      letterSpacing: 0.8,
      textTransform: 'uppercase',
      color: colors.textFaint,
      marginTop: spacing(7),
      marginBottom: spacing(2),
    },
    chips: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing(2) },
    chip: {
      backgroundColor: colors.surfaceAlt,
      borderRadius: radius.pill,
      paddingVertical: spacing(1.5),
      paddingHorizontal: spacing(3),
    },
    chipText: { fontFamily: font.med, fontSize: 12, color: colors.textDim },

    form: { flexDirection: 'row', gap: spacing(2), marginTop: spacing(3) },
    input: {
      backgroundColor: colors.surfaceAlt,
      borderRadius: radius.sm,
      paddingHorizontal: spacing(3),
      paddingVertical: spacing(2.5),
      fontFamily: font.body,
      fontSize: 14,
      color: colors.text,
    },
    addBtn: {
      width: 44,
      borderRadius: radius.sm,
      backgroundColor: colors.accent,
      alignItems: 'center',
      justifyContent: 'center',
    },
    addBtnText: { fontFamily: font.display, fontSize: 20, color: '#FFF' },

    empty: { fontFamily: font.body, fontSize: 13, color: colors.textDim, marginTop: spacing(5), textAlign: 'center' },
    entry: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing(3),
      paddingVertical: spacing(3),
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderBottomColor: colors.line,
    },
    entryLabel: { fontFamily: font.med, fontSize: 14, color: colors.text },
    entryCat: { fontFamily: font.body, fontSize: 11, color: colors.textFaint, marginTop: 1 },
    entryAmount: { fontFamily: font.display, fontSize: 14, color: colors.text },

    note: { fontFamily: font.body, fontSize: 11, color: colors.textFaint, marginTop: spacing(5), lineHeight: 16 },
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
