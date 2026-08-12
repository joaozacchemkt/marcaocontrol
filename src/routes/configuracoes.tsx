import { createFileRoute } from '@tanstack/react-router'

export const Route = createFileRoute('/configuracoes')({
  component: RouteComponent,
})

function RouteComponent() {
  return <div>Hello "/configuracoes"!</div>
}
