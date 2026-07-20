import React, { useState } from 'react';
import { StatusBar, StyleSheet, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { AuthStackParamList } from '../../navigation/types';
import { FlagrrLogo } from '../../components/common/FlagrrLogo';
import { PillButton } from '../../components/common/PillButton';
import { TextField } from '../../components/common/TextField';
import { useApp } from '../../context/AppContext';
import { colors, screenPadding, spacing } from '../../theme';

type Props = NativeStackScreenProps<AuthStackParamList, 'SignUpStep2'>;

export function SignUpStep2Screen({ navigation, route }: Props) {
  const { login } = useApp();
  const [username, setUsername] = useState(route.params.email ?? '');
  const [password, setPassword] = useState('');

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" />
      <SafeAreaView style={styles.safeArea}>
        <TouchableOpacity
          onPress={() => navigation.goBack()}
          hitSlop={12}
          style={styles.backButton}
        >
          <Ionicons name="chevron-back" size={24} color={colors.white} />
        </TouchableOpacity>

        <View style={styles.logoRow}>
          <FlagrrLogo size={36} />
        </View>

        <View style={styles.form}>
          <TextField
            icon="person-outline"
            placeholder="Username or Email"
            autoCapitalize="none"
            value={username}
            onChangeText={setUsername}
          />
          <View style={{ height: spacing.md }} />
          <TextField icon="lock-closed-outline" placeholder="Password" isPassword value={password} onChangeText={setPassword} />

          <View style={{ height: spacing.lg }} />
          <PillButton label="Sign Up" disabled={!password} onPress={login} />
        </View>
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.darkGreen },
  safeArea: { flex: 1, paddingHorizontal: screenPadding },
  backButton: { width: 32, height: 32, justifyContent: 'center', marginTop: spacing.sm },
  logoRow: { alignItems: 'center', marginTop: spacing.md },
  form: { marginTop: spacing.xl },
});
