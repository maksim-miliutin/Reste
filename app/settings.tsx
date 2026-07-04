import React from 'react';
import { Pressable, ScrollView, StyleSheet, Switch, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Sector } from '@/domain/tariffs';
import { Lang, deviceLang, useT } from '@/i18n';
import { useAppStore } from '@/store/useAppStore';
import { Palette, font, radius, spacing, useColors, useThemedStyles } from '@/theme';

const SECTORS: Sector[] = ['secteur1', 'secteur2_optam', 'secteur2'];
const LANGS: Lang[] = ['fr', 'en', 'ru'];

/**
 * Your situation.
 *
 * Everything here shifts the result materially: the doctor's sector moves the
 * reimbursement base, going outside the care pathway drops the rate from 70%
 * to 30%, ALD raises it to 100%. Each toggle therefore states what it changes —
 * otherwise people set them at random and get a wrong figure without knowing why.
 */
export default function Settings() {
  const colors = useColors();
  const styles = useThemedStyles(createStyles);
  const router = useRouter();

  const lang = useAppStore((s) => s.lang);
  const t = useT(lang ?? deviceLang());
  const setLang = useAppStore((s) => s.setLang);

  const sector = useAppStore((s) => s.sector);
  const setSector = useAppStore((s) => s.setSector);
  const pathway = useAppStore((s) => s.coordinatedPathway);
  const setPathway = useAppStore((s) => s.setPathway);
  const fullCoverage = useAppStore((s) => s.fullCoverage);
  const setFullCoverage = useAppStore((s) => s.setFullCoverage);
  const exemption = useAppStore((s) => s.exemption);
  const setExemption = useAppStore((s) => s.setExemption);
  const clearLines = useAppStore((s) => s.clearLines);

  return (
    <SafeAreaView style={styles.screen} edges={['top', 'left', 'right']}>
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <Text style={styles.title}>{t('settings.title')}</Text>

        <Text style={styles.section}>{t('settings.sector')}</Text>
        <Text style={styles.hint}>{t('settings.sectorHint')}</Text>
        <View style={styles.chips}>
          {SECTORS.map((s) => (
            <Pressable
              key={s}
              onPress={() => setSector(s)}
              style={[styles.chip, sector === s && { backgroundColor: colors.accent }]} accessibilityRole="radio"
            >
              <Text style={[styles.chipText, sector === s && { color: '#FFF' }]}>
                {t(`sector.${s}`)}
              </Text>
            </Pressable>
          ))}
        </View>

        <View style={styles.row}>
          <View style={styles.rowText}>
            <Text style={styles.rowLabel}>{t('settings.pathway')}</Text>
            <Text style={styles.rowHint}>{t('settings.pathwayHint')}</Text>
          </View>
          <Switch
            value={pathway}
            onValueChange={setPathway}
            trackColor={{ true: colors.accent, false: colors.surfaceAlt }}
          />
        </View>

        <View style={styles.row}>
          <View style={styles.rowText}>
            <Text style={styles.rowLabel}>{t('settings.fullCoverage')}</Text>
            <Text style={styles.rowHint}>{t('settings.fullCoverageHint')}</Text>
          </View>
          <Switch
            value={fullCoverage}
            onValueChange={setFullCoverage}
            trackColor={{ true: colors.accent, false: colors.surfaceAlt }}
          />
        </View>

        {/* A separate toggle, not a consequence of the previous one: ALD
            reimburses 100% but the participation forfaitaire is still charged.
            While one was inferred from the other, ALD costs were understated. */}
        <View style={styles.row}>
          <View style={styles.rowText}>
            <Text style={styles.rowLabel}>{t('settings.exemption')}</Text>
            <Text style={styles.rowHint}>{t('settings.exemptionHint')}</Text>
          </View>
          <Switch
            value={exemption}
            onValueChange={setExemption}
            trackColor={{ true: colors.accent, false: colors.surfaceAlt }}
          />
        </View>

        <Text style={styles.section}>{t('settings.language')}</Text>
        <View style={styles.chips}>
          {LANGS.map((l) => (
            <Pressable
              key={l}
              onPress={() => setLang(l)}
              style={[styles.chip, lang === l && { backgroundColor: colors.accent }]} accessibilityRole="radio"
            >
              <Text style={[styles.chipText, lang === l && { color: '#FFF' }]}>
                {l.toUpperCase()}
              </Text>
            </Pressable>
          ))}
        </View>

        <Pressable style={styles.danger} onPress={clearLines} accessibilityRole="button">
          <Text style={styles.dangerText}>{t('settings.clear')}</Text>
        </Pressable>

        <Text style={styles.note}>{t('settings.privacy')}</Text>

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

    section: {
      fontFamily: font.med,
      fontSize: 12,
      letterSpacing: 0.8,
      textTransform: 'uppercase',
      color: colors.textFaint,
      marginTop: spacing(7),
    },
    hint: { fontFamily: font.body, fontSize: 12, color: colors.textDim, marginTop: spacing(1), lineHeight: 17 },

    chips: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing(2), marginTop: spacing(3) },
    chip: {
      backgroundColor: colors.surfaceAlt,
      borderRadius: radius.pill,
      paddingVertical: spacing(2),
      paddingHorizontal: spacing(3.5),
    },
    chipText: { fontFamily: font.med, fontSize: 13, color: colors.textDim },

    row: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing(4),
      backgroundColor: colors.surface,
      borderRadius: radius.md,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: colors.line,
      padding: spacing(4),
      marginTop: spacing(3),
    },
    rowText: { flex: 1 },
    rowLabel: { fontFamily: font.med, fontSize: 14, color: colors.text },
    rowHint: { fontFamily: font.body, fontSize: 12, color: colors.textDim, marginTop: 2, lineHeight: 17 },

    danger: {
      marginTop: spacing(7),
      borderRadius: radius.md,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: colors.danger,
      paddingVertical: spacing(3),
      alignItems: 'center',
    },
    dangerText: { fontFamily: font.med, fontSize: 14, color: colors.danger },

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
