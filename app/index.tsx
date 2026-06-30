import React, { useMemo } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { expiryNotice } from '@/domain/ceilings';
import { computeQuote } from '@/domain/reimbursement';
import { deviceLang, useT } from '@/i18n';
import { useAppStore } from '@/store/useAppStore';
import { useQuoteInputs, useSituation } from '@/store/useQuote';
import { Palette, font, radius, spacing, useColors, useThemedStyles } from '@/theme';
import { useRouter } from 'expo-router';

const euro = (n: number) =>
  new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR' }).format(n);

/**
 * Main screen: quote → what comes back → what you are left with.
 *
 * The out-of-pocket figure is set larger than everything else: it is the number
 * people look for and the one the system hides. Below it, the full breakdown
 * with sources, so the figure can be checked rather than trusted blindly.
 */
export default function Home() {
  const colors = useColors();
  const styles = useThemedStyles(createStyles);
  const t = useT(useAppStore((s) => s.lang) ?? deviceLang());
  const router = useRouter();

  const lines = useAppStore((s) => s.lines);
  const contract = useAppStore((s) => s.contract);
  const inputs = useQuoteInputs();
  const situation = useSituation();

  // The expiry reminder appears on its own, and only when it makes sense.
  const expiry = useMemo(
    () => expiryNotice(contract, situation.consumedThisYear ?? {}),
    [contract, situation.consumedThisYear],
  );

  const quote = useMemo(() => computeQuote(inputs, contract, situation), [inputs, contract, situation]);

  return (
    <SafeAreaView style={styles.screen} edges={['top', 'left', 'right']}>
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <View style={styles.topBar}>
          <Text style={styles.eyebrow}>{t('app.name')}</Text>
          <Pressable onPress={() => router.push('/settings')} hitSlop={12} accessibilityRole="button">
            <Text style={styles.settingsLink}>{t('settings.title')}</Text>
          </Pressable>
        </View>
        <Text style={styles.title}>{t('home.title')}</Text>
        <Text style={styles.sub}>{t('home.sub')}</Text>

        {/* The headline: out-of-pocket, larger than everything else */}
        <View style={styles.hero}>
          <Text style={styles.heroLabel}>{t('home.rac')}</Text>
          <Text style={styles.heroValue}>{euro(quote.restACharge)}</Text>
          <View style={styles.heroSplit}>
            <View style={styles.heroCell}>
              <Text style={styles.cellValue}>{euro(quote.charged)}</Text>
              <Text style={styles.cellLabel}>{t('home.charged')}</Text>
            </View>
            <View style={styles.heroCell}>
              <Text style={[styles.cellValue, { color: colors.good }]}>{euro(quote.securiteSociale)}</Text>
              <Text style={styles.cellLabel}>{t('home.ss')}</Text>
            </View>
            <View style={styles.heroCell}>
              <Text style={[styles.cellValue, { color: colors.good }]}>{euro(quote.mutuelle)}</Text>
              <Text style={styles.cellLabel}>{t('home.mutuelle')}</Text>
            </View>
          </View>
        </View>

        {quote.unknownLines > 0 && (
          <Pressable
            style={styles.incomplete}
            onPress={() => router.push('/review')}
            accessibilityRole="button"
          >
            <Text style={styles.incompleteText}>
              {t('home.incomplete', { n: quote.unknownLines })}
            </Text>
          </Pressable>
        )}

        {expiry && (
          <Pressable style={styles.expiry} onPress={() => router.push('/ledger')} accessibilityRole="button">
            <Text style={styles.expiryTitle}>
              {t('expiry.title', { n: euro(expiry.total) })}
            </Text>
            <Text style={styles.expiryBody}>{t('expiry.body', { d: expiry.daysLeft })}</Text>
          </Pressable>
        )}

        {/* Per-line breakdown with every step */}
        {quote.lines.length === 0 ? (
          <View style={styles.first}>
            <Text style={styles.firstTitle}>{t('first.title')}</Text>
            <Text style={styles.firstStep}>{t('first.s1')}</Text>
            <Text style={styles.firstStep}>{t('first.s2')}</Text>
            <Text style={styles.firstStep}>{t('first.s3')}</Text>
          </View>
        ) : (
          quote.lines.map((line, i) => (
            <Pressable
              key={lines[i]?.id ?? i}
              onPress={() => router.push('/review')}
              style={styles.card}
              accessibilityRole="button"
              accessibilityHint={t('home.tapToEdit')}
            >
              <View style={styles.cardTop}>
                <Text style={styles.cardTitle}>{line.label}</Text>
                <Text style={styles.cardCharged}>{euro(line.charged)}</Text>
              </View>

              {line.steps.map((step, k) => (
                <View key={k} style={styles.step}>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.stepLabel}>
                      {t(`step.${step.key}`, {
                        rate: step.detail?.rate ? `${Math.round(Number(step.detail.rate) * 100)} %` : '',
                      })}
                    </Text>
                    {step.detail?.dailyCap !== undefined && (
                      <Text style={styles.stepSource}>
                        {t('step.dailyCap', { cap: String(step.detail.dailyCap) })}
                      </Text>
                    )}
                    {step.source && <Text style={styles.stepSource}>{step.source}</Text>}
                  </View>
                  <Text
                    style={[
                      styles.stepValue,
                      { color: step.amount >= 0 ? colors.text : colors.danger },
                    ]}
                  >
                    {step.amount >= 0 ? '' : '−'}
                    {euro(Math.abs(step.amount))}
                  </Text>
                </View>
              ))}

              {lines[i]?.status === 'mismatch' && (
                <Text style={styles.warn}>
                  {t('home.mismatch', { ref: lines[i].referenceBase ?? 0 })}
                </Text>
              )}
              {lines[i]?.status === 'unknown' && (
                <Text style={styles.warn}>{t('home.unknownBase')}</Text>
              )}
              {line.cappedByCeiling > 0 && (
                <Text style={styles.warn}>
                  {t('home.ceilingHit', { n: line.cappedByCeiling.toFixed(2) })}
                </Text>
              )}

              <View style={styles.cardFoot}>
                <Text style={styles.footLabel}>{t('home.rac')}</Text>
                <Text style={styles.footValue}>{euro(line.restACharge)}</Text>
              </View>
            </Pressable>
          ))
        )}

        <Pressable style={styles.add} onPress={() => router.push('/scan')} accessibilityRole="button">
          <Text style={styles.addText}>{t('home.scan')}</Text>
        </Pressable>

        {lines.length > 0 && (
          <Pressable style={styles.ghost} onPress={() => router.push('/compare')} accessibilityRole="button">
            <Text style={styles.addText}>{t('home.compare')}</Text>
          </Pressable>
        )}

        <Pressable style={styles.ghost} onPress={() => router.push('/contract')} accessibilityRole="button">
          <Text style={styles.ghostText}>
            {contract ? contract.name || t('contract.custom') : t('home.noContract')}
          </Text>
        </Pressable>

        <Text style={styles.disclaimer}>{t('disclaimer')}</Text>
      </ScrollView>
    </SafeAreaView>
  );
}

const createStyles = (colors: Palette) =>
  StyleSheet.create({
    screen: { flex: 1, backgroundColor: colors.bg },
    content: { padding: spacing(5), paddingBottom: spacing(12) },

    topBar: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
    settingsLink: { fontFamily: font.med, fontSize: 12, color: colors.textDim },
    eyebrow: { fontFamily: font.med, fontSize: 12, letterSpacing: 1, textTransform: 'uppercase', color: colors.textFaint },
    title: { fontFamily: font.display, fontSize: 26, color: colors.text, marginTop: spacing(1) },
    sub: { fontFamily: font.body, fontSize: 14, color: colors.textDim, marginTop: spacing(1), lineHeight: 20 },

    hero: {
      backgroundColor: colors.accentSoft,
      borderRadius: radius.lg,
      padding: spacing(5),
      marginTop: spacing(5),
    },
    heroLabel: { fontFamily: font.med, fontSize: 13, color: colors.accentDeep },
    heroValue: { fontFamily: font.display, fontSize: 40, color: colors.accentDeep, marginTop: spacing(1) },
    heroSplit: { flexDirection: 'row', marginTop: spacing(4), gap: spacing(3) },
    heroCell: { flex: 1 },
    cellValue: { fontFamily: font.display, fontSize: 15, color: colors.text },
    cellLabel: { fontFamily: font.body, fontSize: 11, color: colors.textDim, marginTop: 2 },

    first: {
      backgroundColor: colors.surface,
      borderRadius: radius.md,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: colors.line,
      padding: spacing(5),
      marginTop: spacing(4),
    },
    firstTitle: { fontFamily: font.med, fontSize: 14, color: colors.text, marginBottom: spacing(2) },
    firstStep: { fontFamily: font.body, fontSize: 13, color: colors.textDim, lineHeight: 20, marginTop: spacing(1) },

    incomplete: {
      backgroundColor: colors.surface,
      borderRadius: radius.md,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: colors.warning,
      padding: spacing(4),
      marginTop: spacing(4),
    },
    incompleteText: { fontFamily: font.med, fontSize: 13, color: colors.warning, lineHeight: 18 },

    expiry: {
      backgroundColor: colors.surface,
      borderRadius: radius.md,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: colors.line,
      padding: spacing(4),
      marginTop: spacing(4),
    },
    expiryTitle: { fontFamily: font.med, fontSize: 14, color: colors.text },
    expiryBody: { fontFamily: font.body, fontSize: 12, color: colors.textDim, marginTop: spacing(1), lineHeight: 17 },

    card: {
      backgroundColor: colors.surface,
      borderRadius: radius.md,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: colors.line,
      padding: spacing(4),
      marginTop: spacing(3),
    },
    cardTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline', gap: spacing(2) },
    cardTitle: { flex: 1, fontFamily: font.med, fontSize: 15, color: colors.text },
    cardCharged: { fontFamily: font.display, fontSize: 15, color: colors.text },

    step: { flexDirection: 'row', alignItems: 'flex-start', gap: spacing(3), marginTop: spacing(3) },
    stepLabel: { fontFamily: font.body, fontSize: 13, color: colors.textDim },
    stepSource: { fontFamily: font.body, fontSize: 10, color: colors.textFaint, marginTop: 1 },
    stepValue: { fontFamily: font.med, fontSize: 13 },

    cardFoot: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      marginTop: spacing(4),
      paddingTop: spacing(3),
      borderTopWidth: StyleSheet.hairlineWidth,
      borderTopColor: colors.line,
    },
    footLabel: { fontFamily: font.med, fontSize: 13, color: colors.text },
    footValue: { fontFamily: font.display, fontSize: 16, color: colors.accentDeep },

    add: {
      marginTop: spacing(4),
      borderRadius: radius.md,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: colors.accent,
      paddingVertical: spacing(3),
      alignItems: 'center',
    },
    addText: { fontFamily: font.med, fontSize: 14, color: colors.accent },
    ghost: { paddingVertical: spacing(3), alignItems: 'center' },
    ghostText: { fontFamily: font.body, fontSize: 13, color: colors.textDim },
    warn: {
      fontFamily: font.body,
      fontSize: 11,
      color: colors.warning,
      marginTop: spacing(3),
      lineHeight: 15,
    },

    disclaimer: {
      fontFamily: font.body,
      fontSize: 11,
      color: colors.textFaint,
      marginTop: spacing(6),
      lineHeight: 16,
    },
  });
