import { toast } from 'sonner'
import { AlertTriangle, CheckCircle, Info, XCircle } from 'lucide-react'

type ToastOptions = Parameters<typeof toast>[1]

const successIcon = <CheckCircle className="h-4 w-4 text-emerald-600" />
const errorIcon = <XCircle className="h-4 w-4 text-red-600" />
const infoIcon = <Info className="h-4 w-4 text-slate-500" />
const warningIcon = <AlertTriangle className="h-4 w-4 text-yellow-600" />

export const toastSuccess = (title: string, options: ToastOptions = {}) =>
  toast(title, { ...options, icon: successIcon })

export const toastError = (title: string, options: ToastOptions = {}) =>
  toast(title, { ...options, icon: errorIcon })

export const toastInfo = (title: string, options: ToastOptions = {}) =>
  toast(title, { ...options, icon: infoIcon })

export const toastWarning = (title: string, options: ToastOptions = {}) =>
  toast(title, { ...options, icon: warningIcon })
