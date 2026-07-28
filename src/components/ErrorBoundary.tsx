import { Component, type ReactNode } from 'react'
import { AlertTriangle, RefreshCw } from 'lucide-react'
import { Button } from '@/components/ui/button'

interface Props { children: ReactNode; fallbackTitle?: string }
interface State { hasError: boolean; error: Error | null }

export class ErrorBoundary extends Component<Props, State> {
  state: State = { hasError: false, error: null }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error }
  }

  componentDidCatch(error: Error, info: React.ErrorInfo) {
    console.error('ErrorBoundary caught:', error, info.componentStack)
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="flex items-center justify-center h-full min-h-[200px] p-6">
          <div className="text-center space-y-3 max-w-sm">
            <AlertTriangle size={32} className="text-amber-400 mx-auto" />
            <h3 className="text-sm font-medium text-zinc-300">
              {this.props.fallbackTitle || 'Something went wrong'}
            </h3>
            <p className="text-xs text-zinc-500">
              {this.state.error?.message || 'An unexpected error occurred'}
            </p>
            <Button
              variant="outline"
              size="sm"
              className="gap-1.5"
              onClick={() => this.setState({ hasError: false, error: null })}
            >
              <RefreshCw size={12} /> Try again
            </Button>
          </div>
        </div>
      )
    }
    return this.props.children
  }
}
