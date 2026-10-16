import '@fontsource/roboto-mono/latin-400.css'
import '@fontsource/roboto-mono/latin-500.css'
import '@fontsource/roboto-mono/latin-700.css'
import './index.css'

async function bootstrap() {
  const { enableMocking } = await import('./mocks/enable')
  await enableMocking()
  const { mountApp } = await import('./app/mount')
  mountApp()
}
void bootstrap().catch((error: unknown) => {
  console.error('Falha ao iniciar Kurio', error)
  document.getElementById('root')!.textContent =
    'Não foi possível iniciar a aplicação. Consulte o console.'
})
