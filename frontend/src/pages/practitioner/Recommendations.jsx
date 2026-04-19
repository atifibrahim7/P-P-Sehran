import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'

export default function PractitionerRecommendations() {
  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-semibold tracking-tight">Practitioner · Recommendations</h1>
      <Card className="border-border/80 shadow-none">
        <CardHeader>
          <CardTitle className="text-base">Placeholder</CardTitle>
        </CardHeader>
        <CardContent className="text-sm text-muted-foreground">
          Build recommendations UI (assign products to patients, save drafts).
        </CardContent>
      </Card>
    </div>
  )
}
