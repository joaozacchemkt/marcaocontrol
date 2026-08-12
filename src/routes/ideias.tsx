import { createFileRoute } from '@tanstack/react-router'

export const Route = createFileRoute('/ideias')({
  component: RouteComponent,
})

function RouteComponent() {
  return <div>Hello "/ideias"!</div>
}
