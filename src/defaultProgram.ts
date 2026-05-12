/**
 * Default RISC-V sample program — Array swap example
 * Demonstrates: .data, .word, la, lw, sw, slli, add, call, ret, ecall
 */
export const DEFAULT_PROGRAM = `\
.data
numbers:
    .word 10, 20, 30, 40


.text
.globl main

main:
    # 1. Load base address of the array
    la a0, numbers          # a0 points to numbers[0]

    # 2. Create another alias pointer to same buffer
    mv t0, a0               # t0 also points to numbers[0]

    # 3. Choose index 2
    li a1, 2                # a1 = index 2

    # 4. Convert index to byte offset
    slli t1, a1, 2          # t1 = 2 * 4 = 8 bytes

    # 5. Create pointer to numbers[2]
    add t2, a0, t1          # t2 points to numbers[2]

    # 6. Load numbers[2]
    lw t3, 0(t2)            # t3 = numbers[2] = 30

    # 7. Change value
    addi t3, t3, 5          # t3 = 35

    # 8. Store changed value back
    sw t3, 0(t2)            # numbers[2] = 35

    # 9. Print updated value
    mv a1, t3               # a1 = 35
    li a0, 1                # print integer
    ecall

    # 10. Exit
    li a0, 10
    ecall
`;
