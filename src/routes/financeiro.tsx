import { createFileRoute } from '@tanstack/react-router'

export const Route = createFileRoute('/financeiro')({
  component: RouteComponent,
})

function RouteComponent() {
  return <div>Hello "/financeiro"!</div>
}
