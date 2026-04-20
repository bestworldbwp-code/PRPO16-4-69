/**
 * Converts a number to Thai Baht text.
 * @param amount The number to convert
 * @returns Thai Baht text string
 */
export function bahttext(amount: number): string {
  if (amount === 0) return 'ศูนย์บาทถ้วน'
  
  const numbers = ['ศูนย์', 'หนึ่ง', 'สอง', 'สาม', 'สี่', 'ห้า', 'หก', 'เจ็ด', 'แปด', 'เก้า']
  const units = ['', 'สิบ', 'ร้อย', 'พัน', 'หมื่น', 'แสน', 'ล้าน']
  
  const [integerPart, decimalPart] = amount.toFixed(2).split('.')
  
  let result = ''
  
  // Handle integer part
  const intArr = integerPart.split('').reverse()
  for (let i = 0; i < intArr.length; i++) {
    const n = parseInt(intArr[i])
    if (n === 0) continue
    
    let unit = units[i % 6]
    if (i > 0 && i % 6 === 0) {
      result = units[6] + result
    }
    
    let digit = numbers[n]
    if (i % 6 === 0 && n === 1 && intArr.length > 1 && (i === 0 || i % 6 === 0)) {
      digit = 'เอ็ด'
    } else if (i % 6 === 1 && n === 2) {
      digit = 'ยี่'
    } else if (i % 6 === 1 && n === 1) {
      digit = ''
    }
    
    result = digit + unit + result
  }
  
  if (result) result += 'บาท'
  
  // Handle decimal part
  if (parseInt(decimalPart) === 0) {
    result += 'ถ้วน'
  } else {
    const decArr = decimalPart.split('')
    for (let i = 0; i < decArr.length; i++) {
      const n = parseInt(decArr[i])
      if (n === 0 && i === 0) continue
      
      let unit = i === 0 ? 'สิบ' : ''
      let digit = numbers[n]
      
      if (i === 1 && n === 1 && decArr[0] !== '0') {
        digit = 'เอ็ด'
      } else if (i === 0 && n === 2) {
        digit = 'ยี่'
      } else if (i === 0 && n === 1) {
        digit = ''
      }
      
      result += digit + unit
    }
    result += 'สตางค์'
  }
  
  return result
}
