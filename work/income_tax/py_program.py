# income = 510  # 年収

# 基礎控除　basic_deduction

# 給与所得控除　employment_income_deduction

def calc_employment_income_deduction(income):
    if income < 162.5:
        return 55
    elif income < 180:
        return income * 0.4 - 10
    elif income < 360:
        return income * 0.3 + 8
    elif income < 660:
        return income * 0.2 + 44
    elif income < 850:
        return income * 0.1 + 110
    else:
        return 195
    
def calc_basic_deduction(income):
    if income <= 132:
        return 95
    elif income <= 336:
        return 88
    elif income <= 489:
        return 68
    elif income <= 655:
        return 63
    elif income <= 2350:
        return 58
    else:
        return 0

def calc_income_tax(income):
    if income < 195:
        return income * 0.05
    elif income < 330:
        return income * 0.1 - 9.75
    elif income < 695:
        return income * 0.2 - 42.75
    elif income < 900:
        return income * 0.23 - 63.6
    elif income < 1800:
        return income * 0.33 - 153.6
    elif income < 4000:
        return income * 0.4 - 279.6
    else:
        return income * 0.45 - 479.6

def calculation(income):
    employment_income_deduction = calc_employment_income_deduction(income)
    print(f"給与所得控除 : {employment_income_deduction}万円")
    income -= employment_income_deduction
    basic_deduction = calc_basic_deduction(income)
    print(f"基礎控除　　: {basic_deduction}万円")
    income -= basic_deduction
    print(f"課税所得　　: {income}万円")
    income_tax = calc_income_tax(income)
    print(f"所得税　　　: {income_tax:.2f}万円")

if __name__ == "__main__":
    print("=== 年収から所得税を計算 ===")
    calculation(input_income)