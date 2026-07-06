import React, { useMemo } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { compareScenarios } from '@/domain/compare';
import { deviceLang, useT } from '@/i18n';
import { useAppStore } from '@/store/useAppStore';
import { useQuoteInputs, useSituation } from '@/store/useQuote';
import { Palette, font, radius, spacing, useColors, useThemedStyles } from '@/theme';

const euro = (n: number) =>
  new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR' }).format(n);

/**
 * Comparison before signing.
 *
 * The screen exists for one number: how much more you pay compared with the
 * zero-out-of-pocket option the dentist was required to show you.
 */
export default function Compare() {
  const colors = useColors();
  const styles = useThemedStyles(createStyles);
  const router = useRouter();
  const t = useT(useAppStore((s) => s.lang) ?? deviceLang());

  const contract = useAppStore((s) => s.contract);
  const inputs = useQuoteInputs();
  const situation = useSituation();

  const scenarios = useMemo(
    () => compareScenarios(inputs, contract, situation),
    [inputs, contract, situation],
  );

  const zero = scenarios.find((s) => s.key === 'zeroRac');

  return (
    <SafeAreaView style={styles.screen} edges={['top', 'left', 'right']}>
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <Text style={styles.title}>{t('compare.title')}</Text>
        <Text style={styles.sub}>{t('compare.sub')}</Text>

        {inputs.length === 0 ? (
          <Text style={styles.empty}>{t('compare.empty')}</Text>
        ) : (
          <>
            {/* The headline: gap against the zero-out-of-pocket basket */}
            {zero && zero.deltaVsQuote < 0 && (
              <View style={styles.gap}>
                <Text style={styles.gapLabel}>{t('compare.couldSave')}</Text>
                <Text style={styles.gapValue}>{euro(Math.abs(zero.deltaVsQuote))}</Text>
                <Text style={styles.gapNote}>{t('compare.legalNote')}</Text>
              </View>
            )}

            {scenarios.map((s) => (
              <View key={s.key} style={styles.card}>
                <View style={styles.cardHead}>
                  <Text style={styles.cardTitle}>{t(`compare.${s.key}`)}</Text>
                  {s.deltaVsQuote !== 0 && (
                    <Text
                      style={[
                        styles.delta,
                        { color: s.deltaVsQuote < 0 ? colors.good : colors.danger },
                      ]}
                    >
                      {s.deltaVsQuote < 0 ? '−' : '+'}
                      {euro(Math.abs(s.deltaVsQuote))}
                    </Text>
                  )}
                </View>

                <View style={styles.grid}>
                  <View style={styles.cell}>
                    <Text style={styles.cellValue}>{euro(s.result.charged)}</Text>
                    <Text style={styles.cellLabel}>{t('home.charged')}</Text>
                  </View>
                  <View style={styles.cell}>
                    <Text style={[styles.cellValue, { color: colors.good }]}>
                      {euro(s.result.securiteSociale + s.result.mutuelle)}
                    </Text>
                    <Text style={styles.cellLabel}>{t('compare.covered')}</Text>
                  </View>
                  <View style={styles.cell}>
                    <Text style={[styles.cellValue, { color: colors.accentDeep }]}>
                      {euro(s.result.restACharge)}
                    </Text>
                    <Text style={styles.cellLabel}>{t('home.rac')}</Text>
                  </View>
                </View>
              </View>
            ))}

            {!zero && <Text style={styles.note}>{t('compare.noBasket')}</Text>}
          </>
        )}

        <Text style={styles.disclaimer}>{t('compare.disclaimer')}</Text>

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
    empty: { fontFamily: font.body, fontSize: 14, color: colors.textDim, marginTop: spacing(8), textAlign: 'center' },

    gap: {
      backgroundColor: colors.accentSoft,
      borderRadius: radius.lg,
      padding: spacing(5),
      marginTop: spacing(5),
    },
    gapLabel: { fontFamily: font.med, fontSize: 13, color: colors.accentDeep },
    gapValue: { fontFamily: font.display, fontSize: 36, color: colors.accentDeep, marginTop: spacing(1) },
    gapNote: { fontFamily: font.body, fontSize: 12, color: colors.accentDeep, marginTop: spacing(2), lineHeight: 17 },

    card: {
      backgroundColor: colors.surface,
      borderRadius: radius.md,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: colors.line,
      padding: spacing(4),
      marginTop: spacing(3),
    },
    cardHead: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline' },
    cardTitle: { fontFamily: font.med, fontSize: 15, color: colors.text },
    delta: { fontFamily: font.display, fontSize: 15 },

    grid: { flexDirection: 'row', gap: spacing(3), marginTop: spacing(3) },
    cell: { flex: 1 },
    cellValue: { fontFamily: font.display, fontSize: 15, color: colors.text },
    cellLabel: { fontFamily: font.body, fontSize: 11, color: colors.textDim, marginTop: 2 },

    note: { fontFamily: font.body, fontSize: 12, color: colors.textDim, marginTop: spacing(4), lineHeight: 17 },
    disclaimer: { fontFamily: font.body, fontSize: 11, color: colors.textFaint, marginTop: spacing(6), lineHeight: 16 },

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
