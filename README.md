# Shim-Index
Original manifestation of shim program using vector

Original thesis of shim as follows.

GOAL

Create a program that will iterate through all possible permutations of shim configuration based on the given set of rules. The program will present the set randomly without repeats and allow the user to manually progress/regress through the permutation set and visually inspect and output the focus. For the sake of expediency, we should begin with a web output based on the provided defaults.

DESCRIPTION

In his work, Montgomery takes a shim, or a group of joined shims, and arranges it in column formation on a wall.

The rules are roughly sketched as follows:

    A shim is a 3-D triangular shaped piece of wood. The actual dimensions of a store bought shim are .25"H by 6"L by 1.5"D. The tip is technically 0.0625". Montgomery's shims vary, but the proportion 1x:24x:6x is constant.
    A shim unit is an element that combines 1 through X number of shims. The default is 7. A shim unit may also be a pair of non-attached shim unit elements. For example, a 3-shim shim unit adjacent to another 3-shim shim unit, both facing the same direction. By default, the shim unit can consist of up to 2 independent repeating sub-shim units.
    A shim unit can be reused more than once in a piece.
    A shim unit is placed so that it vertically occupies the visual plane. Its most acute apex can either face up or down.
    A slot is comprised of the space occupied by the chosen shim unit and its accompanying negative space. There are X number of slots in any one piece. The default is 5 slots per piece.
    The accompanying negative space is equal to the depth of the shim. The one exception is the final shim unit, which has no accompanying negative space.

    The orientation of the shims units must alternate slots. If a shim unit is facing up, the following slot must have one facing down.

    28 possibilities for slot 1: a aa b bb c cc d dd e ee f ff g gg -a -aa -b -bb -c -cc -d -dd -e -ee -f -ff -g -gg

    14 possibilities for slot 2 to through 5, relative to slot 1.

The program should be able to manually iterate through the possible permutations quickly and randomly without repeats. The actual output can either be dynamically drawn by the program, or refer to provided gifs (faster?).

For the artist, controlling the defaults is important. We will call these defaults our handles. Our handles are: the size of the combination comprising a shim-unit, the number of slots comprising a piece, and the number of repeating sub-units.

ADD ONS

    Allow GUI access to the handles for control of these inputs.
    Allow a printable (PDF format) of the entire list of permutations.
    Allow viewer to engage multiple images at a time.
