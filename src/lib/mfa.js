// Verificación en dos pasos (TOTP) sobre la API nativa de MFA de
// Supabase Auth -- un solo lugar para las 5 operaciones que se
// necesitan, reutilizado por la pantalla de activación (Preferencias
// personales) y por el paso de verificación en el login.
import { supabase } from './supabase'

export async function listFactors() {
  return supabase.auth.mfa.listFactors()
}

export async function enrollTotp() {
  return supabase.auth.mfa.enroll({ factorType: 'totp', friendlyName: 'SIGAP' })
}

// Confirma la inscripción de un factor recién creado (todavía "no
// verificado") con el primer código que el usuario ve en su app
// autenticadora -- combina challenge + verify porque, a diferencia del
// login, aquí no hace falta guardar el challengeId por separado.
export async function confirmEnrollment(factorId, code) {
  const { data: challengeData, error: challengeError } = await supabase.auth.mfa.challenge({ factorId })
  if (challengeError) return { data: null, error: challengeError }
  return supabase.auth.mfa.verify({ factorId, challengeId: challengeData.id, code })
}

export async function unenrollFactor(factorId) {
  return supabase.auth.mfa.unenroll({ factorId })
}

export async function getAssuranceLevel() {
  return supabase.auth.mfa.getAuthenticatorAssuranceLevel()
}

// Paso de verificación al iniciar sesión -- challengeAndVerify hace
// challenge+verify en una sola llamada, que es todo lo que hace falta
// aquí (no se necesita el challengeId aparte).
export async function verifyLoginChallenge(factorId, code) {
  return supabase.auth.mfa.challengeAndVerify({ factorId, code })
}
