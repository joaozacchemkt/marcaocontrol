import { createFileRoute } from '@tanstack/react-router'

export const Route = createFileRoute('/contatos')({
  component: RouteComponent,
})

function RouteComponent() {
  return <div>Hello "/contatos"!</div>
}
