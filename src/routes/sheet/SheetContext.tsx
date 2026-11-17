import { createContext, useContext } from 'react'
import type { SheetModel } from './useSheetModel'

/** The open character's model, shared by the sheet's tabs */
export const SheetContext = createContext<SheetModel | null>(null)

export function useSheet(): SheetModel {
  const model = useContext(SheetContext)
  if (!model) throw new Error('useSheet() must be used inside the character sheet')
  return model
}
