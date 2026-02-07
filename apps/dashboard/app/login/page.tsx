import { redirectIfAuthenticated } from "@/lib/actions"
import LoginForm from "./login-form"

export default async function LoginPage() {
  // Vérifier si l'utilisateur est déjà connecté (côté serveur)
  await redirectIfAuthenticated()

  return <LoginForm />
} 