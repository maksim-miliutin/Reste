import React, { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { matchLine } from '@/domain/matching';
import { CareCategory, Sector } from '@/domain/tariffs';
import { deviceLang, useT } from '@/i18n';
import { CATEGORIES } from '@/services/ai';
import { QuoteLine, useAppStore } from '@/store/useAppStore';
import { Palette, font, radius, spacing, useColors, useThemedStyles } from '@/theme';

/**
 * Review what was parsed.
 *
 * A human has to stand between OCR and money. The model can miss a line,
 * misread a digit or fail to see the reimbursement base — without this screen
 * the app would present an incomplete result as a complete one.
 *
 * So everything is editable and incomplete lines are highlighted separately:
 * the user sees not only what was read, but what was NOT read.
 */
export default function Review() {
  const colors = useColors();
  const styles = useThemedStyles(createStyles);
  const router = useRouter();
  const t = useT(useAppStore((s) => s.lang) ?? deviceLang());

  const lines = useAppStore((s) => s.lines);
  const updateLine = useAppStore((s) => s.updateLine);
  const removeLine = useAppStore((s) => s.removeLine);
  const sector = useAppStore((s) => s.sector);
  const today = new Date().toISOString().slice(0, 10);

  const needsAttention = lines.filter((l) => l.status === 'unknown' || l.status === 'mismatch');

  return (
    <SafeAreaView style={styles.screen} edges={['top', 'left', 'right']}>
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <Text style={styles.title}>{t('review.title')}</Text>
        <Text style={styles.sub}>{t('review.sub')}</Text>

        {needsAttention.length > 0 && (
          <View style={styles.alert}>
            <Text style={styles.alertText}>
              {t('review.attention', { n: needsAttention.length })}
            </Text>
          </View>
        )}

        {lines.length === 0 ? (
          <Text style={styles.empty}>{t('review.empty')}</Text>
        ) : (
          lines.map((line) => (
            <LineEditor
              key={line.id}
              line={line}
              sector={sector}
              date={today}
              onChange={(patch) => updateLine(line.id, patch)}
              onRemove={() => removeLine(line.id)}
              t={t}
              colors={colors}
              styles={styles}
            />
          ))
        )}

        <Text style={styles.note}>{t('review.note')}</Text>

        <Pressable
          style={styles.done}
          onPress={() => router.replace('/')}
          accessibilityRole="button"
        >
          <Text style={styles.doneText}>{t('review.confirm')}</Text>
        </Pressable>
      </ScrollView>
    </SafeAreaView>
  );
}

interface EditorProps {
  line: QuoteLine;
  sector: Sector;
  date: string;
  onChange: (patch: Partial<Omit<QuoteLine, 'id'>>) => void;
  onRemove: () => void;
  t: (k: string, v?: Record<string, string | number>) => string;
  colors: Palette;
  styles: ReturnType<typeof createStyles>;
}

/** Local field state: otherwise every keystroke recomputes the quote. */
const LineEditor: React.FC<EditorProps> = ({
  line,
  sector,
  date,
  onChange,
  onRemove,
  t,
  colors,
  styles,
}) => {
  const [label, setLabel] = useState(line.label);
  const [charged, setCharged] = useState(String(line.charged));
  const [base, setBase] = useState(line.base !== undefined ? String(line.base) : '');
  const [quantity, setQuantity] = useState(String(line.quantity));

  const num = (v: string) => {
    const n = Number(v.replace(',', '.'));
    return Number.isFinite(n) && n >= 0 ? n : undefined;
  };

  /**
   * Status is computed by the domain, not the screen.
   *
   * It used to be derived here from a single signal — "the base field is empty" —
   * so editing the label of a line found in the catalogue marked it as
   * uncomputable: the calculation stayed correct while the UI said
   * "reimbursement unknown". A false warning costs as much as a wrong number.
   */
  const commit = (patch: Partial<Omit<QuoteLine, 'id'>> = {}) => {
    const next = {
      label: label.trim() || line.label,
      charged: num(charged) ?? line.charged,
      base: base.trim() === '' ? undefined : num(base),
      quantity: Math.max(1, Math.round(num(quantity) ?? line.quantity)),
      category: line.category,
      ...patch,
    };

    const matched = matchLine(
      {
        code: line.actCode || undefined,
        label: next.label,
        charged: next.charged,
        base: next.base,
        quantity: next.quantity,
        category: next.category,
      },
      sector,
      date,
    );

    onChange({ ...next, status: matched.status, referenceBase: matched.referenceBase });
  };

  const flag =
    line.status === 'unknown'
      ? { text: t('review.noBase'), color: colors.warning }
      : line.status === 'mismatch'
        ? { text: t('review.mismatch', { ref: line.referenceBase ?? 0 }), color: colors.warning }
        : null;

  return (
    <View style={[styles.card, flag && { borderColor: colors.warning }]}>
      <View style={styles.cardTop}>
        <TextInput
          style={styles.labelInput}
          value={label}
          onChangeText={setLabel}
          onBlur={() => commit()}
          maxLength={60}
        />
        <Pressable onPress={onRemove} hitSlop={10} accessibilityRole="button">
          <Text style={styles.remove}>✕</Text>
        </Pressable>
      </View>

      {line.actCode ? <Text style={styles.code}>{line.actCode}</Text> : null}

      <View style={styles.fields}>
        <View style={styles.field}>
          <Text style={styles.fieldLabel}>{t('review.charged')}</Text>
          <TextInput
            style={styles.input}
            value={charged}
            onChangeText={setCharged}
            onBlur={() => commit()}
            keyboardType="decimal-pad"
            maxLength={8}
          />
        </View>
        <View style={styles.field}>
          <Text style={styles.fieldLabel}>{t('review.base')}</Text>
          <TextInput
            style={styles.input}
            value={base}
            onChangeText={setBase}
            onBlur={() => commit()}
            keyboardType="decimal-pad"
            placeholder={t('review.basePh')}
            placeholderTextColor={colors.textFaint}
            maxLength={8}
          />
        </View>
        <View style={styles.qtyField}>
          <Text style={styles.fieldLabel}>{t('review.quantity')}</Text>
          <TextInput
            style={styles.input}
            value={quantity}
            onChangeText={setQuantity}
            onBlur={() => commit()}
            keyboardType="number-pad"
            maxLength={2}
          />
        </View>
      </View>

      {/* The category decides which insurer cover applies to the line.
          Without it, a generous dental percentage will not reach a line the
          parser filed under "other". */}
      <Text style={styles.fieldLabel}>{t('review.category')}</Text>
      <View style={styles.cats}>
        {CATEGORIES.map((c: CareCategory) => (
          <Pressable
            key={c}
            onPress={() => commit({ category: c })}
            style={[styles.cat, line.category === c && { backgroundColor: colors.accent }]}
            accessibilityRole="radio"
            accessibilityState={{ selected: line.category === c }}
          >
            <Text style={[styles.catText, line.category === c && { color: '#FFF' }]}>
              {t(`category.${c}`)}
            </Text>
          </Pressable>
        ))}
      </View>

      {flag && <Text style={[styles.flag, { color: flag.color }]}>{flag.text}</Text>}
    </View>
  );
};

const createStyles = (colors: Palette) =>
  StyleSheet.create({
    screen: { flex: 1, backgroundColor: colors.bg },
    content: { padding: spacing(5), paddingBottom: spacing(12) },
    title: { fontFamily: font.display, fontSize: 24, color: colors.text },
    sub: { fontFamily: font.body, fontSize: 14, color: colors.textDim, marginTop: spacing(2), lineHeight: 20 },

    alert: {
      backgroundColor: colors.surfaceAlt,
      borderRadius: radius.md,
      padding: spacing(4),
      marginTop: spacing(4),
    },
    alertText: { fontFamily: font.med, fontSize: 13, color: colors.text, lineHeight: 18 },

    empty: { fontFamily: font.body, fontSize: 14, color: colors.textDim, marginTop: spacing(8), textAlign: 'center' },

    card: {
      backgroundColor: colors.surface,
      borderRadius: radius.md,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: colors.line,
      padding: spacing(4),
      marginTop: spacing(3),
    },
    cardTop: { flexDirection: 'row', alignItems: 'center', gap: spacing(3) },
    labelInput: {
      flex: 1,
      fontFamily: font.med,
      fontSize: 15,
      color: colors.text,
      paddingVertical: spacing(1),
    },
    remove: { fontFamily: font.body, fontSize: 16, color: colors.textFaint },
    code: { fontFamily: font.body, fontSize: 11, color: colors.textFaint, marginTop: 2 },

    fields: { flexDirection: 'row', gap: spacing(3), marginTop: spacing(3) },
    field: { flex: 1 },
    qtyField: { width: 56 },
    cats: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing(2), marginTop: spacing(2) },
    cat: {
      paddingHorizontal: spacing(3),
      paddingVertical: spacing(1.5),
      borderRadius: radius.pill,
      backgroundColor: colors.surfaceAlt,
    },
    catText: { fontFamily: font.body, fontSize: 11, color: colors.textDim },
    fieldLabel: { fontFamily: font.body, fontSize: 11, color: colors.textDim, marginBottom: spacing(1) },
    input: {
      backgroundColor: colors.surfaceAlt,
      borderRadius: radius.sm,
      paddingHorizontal: spacing(3),
      paddingVertical: spacing(2.5),
      fontFamily: font.med,
      fontSize: 14,
      color: colors.text,
    },

    flag: { fontFamily: font.body, fontSize: 11, marginTop: spacing(3), lineHeight: 15 },
    note: { fontFamily: font.body, fontSize: 11, color: colors.textFaint, marginTop: spacing(5), lineHeight: 16 },

    done: {
      marginTop: spacing(5),
      borderRadius: radius.md,
      backgroundColor: colors.accent,
      paddingVertical: spacing(3.5),
      alignItems: 'center',
    },
    doneText: { fontFamily: font.med, fontSize: 15, color: '#FFF' },
  });
