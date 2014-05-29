/*
 *
 * Piece-related algorithms and functions.
 *
 */

/** Maximum seed value. */
var MAX_SEED = 999999;

/** Ratio between shim side and base. */
var side = 64;

/** Ratio between shim tip and base. */
var tip = 0.25;

/** Distance between tip and vanishing point for trapezoidal shim, used to
    compute rotation angle of shims.
    
    tipSide/tip = (tipSide + side)/base, base = 1
    tipSide = tip * (tipSide + side) = tip*tipSide + tip*side
    tipSide - tip*tipSide = tipSide * (1-tip) = tip*side
    tipSide = (tip*side) / (1-tip)
*/
var tipSide = (tip*side) / (1-tip);

/** Angle of shim tips (in radians). Chord is 2*sin(angle/2). */
var shimAngle3 = 2*Math.asin(0.5/side);             /* triangular. */
var shimAngle4 = 2*Math.asin(0.5/(side+tipSide));   /* trapezoidal. */

/** Size of negative space in base units. */
var negativeSpace = 6;

/** Ten primes used to seed the linear congruential generator. */
var primes = [53, 59, 61, 67, 71, 73, 79, 83, 89, 97];

/**
 * Generate increment value for linear congruential generator.
 *
 *  @param seed     Seed value whose decimal digits designate prime factors.
 *
 *  @return increment value for lcg()
 */
function lcg_increment(seed) {
    seed %= (MAX_SEED+1);
    if (seed==0) return primes[0];
    
    var c = 1;
    while (seed > 0) {
        c *= primes[seed % 10];
        seed = Math.floor(seed / 10);
    }
    return c;
}

/**
 * Linear congruential generator x_n+1 = (a.x_n + c) mod m.
 *
 * Used to generate a non-repeating sequence of m=2x^y integers starting at 0.
 *
 *  @param v    Previous value.
 *  @param c    Increment.
 *  @param x    Number of shims per shim unit.
 *  @param y    Number of shim units/slots per piece.
 *
 *  @return serial number.
 */
function lcg(v, c, x, y) {
    // Number of desired permutations.
    var m = 2*Math.pow(x, y);
    
    // LCG will have a full period if and only if:
    // 1. c and m are relatively prime
    // 2. a-1 is divisible by all prime factors of m
    // 3. a-1 is a multiple of 4 if m is a multiple of 4
    //
    // As m=2x^Y, prime factors of m are 2 and x, if x is prime, or x's prime
    // factors otherwise.
    // m is multiple of 4 if and only if x is multiple of 2.
    // #1 is met if x is less than the lowest prime factor used in 
    // lcg_increment().
    
    var a = 2*x+1;  // This guarantees #2 and #3.
    return (a*v+c) % m;
}

/**
 * Generate a random shim permutation.
 *
 *  @param index    Index of piece to generate.
 *  @param c        LCG increment value.
 *  @param x        Number of shims per shim unit.
 *  @param y        Number of shim units/slots per piece.
 *
 *  @return serial number.
 */
function generatePermutation(index, c, x, y) {
    var max = Math.pow(x, y);

    // Generate pseudorandom value in [0, 2*max) by calling LCG with sequence
    // number using the previously computed increment value.
    var r = lcg(index, c, x, y);
    
    // Sign.
    var sign;
    if (r < max) {
        // Negative / downward.
        sign = "-";
    } else {
        // Positive / upward.
        sign = "+";
        r -= max;
    }
    
    // Digits.
    var digits = "";
    for (var i = 0; i < y; i++) {
        digits += String.fromCharCode(65 + (r % x));
        r = Math.floor(r/x);
    }
    
    return sign + digits;
}

/**
 * Test function validating the LCG-based permutation generator.
 *
 *  Avoid calling with too large values!!!
 *
 *  @param x        Number of shims per shim unit.
 *  @param y        Number of shim units/slots per piece.
 *  @param seed     Seed used to generate LCG increment value.
 */
function testUnicity(x, y, seed) {
    var c = lcg_increment(seed);
    var max = 2*Math.pow(x,y);
    var values = Array();
    var dup = Array();
    for (var i = 0; i < max; i++) {
        var key = lcg(i, c, x, y);
        if (typeof(values[key]) === 'undefined') {
            values[key] = [i];
        } else {
            values[key].push(i);
            dup[key] = values[key];
        }
    }
    return {dup: dup, total: Object.keys(values).length};
}

/**
 * Rotate point *p* around center *c* by given *angle*.
 *
 *  @param c        Center of rotation.
 *  @param p        Point to rotate.
 *  @param angle    Rotation angle in radians.
 *
 *  @return Rotated point.
 */
function rotate(c, p, angle) {
    return {
        x: Math.cos(angle) * (p.x-c.x) - Math.sin(angle) * (p.y-c.y) + c.x,
        y: Math.sin(angle) * (p.x-c.x) + Math.cos(angle) * (p.y-c.y) + c.y
    };
}

/**
 * Project line passing trought *c* and *p* on horizontal line at *y*.
 *
 *  @param c, p     Points on line to project.
 *  @param y        Y-coordinate of line to project onto.
 *
 *  @return Projected point.
 */
function project(c, p, y) {
    return {
        x: c.x + (p.x-c.x) / (p.y-c.y) * (y-c.y),
        y: y
    };
}

/**
 * Compute a piece from its serial number.
 *
 *  @param sn           The piece serial number.
 *  @param options      Piece options: cropped, trapezoidal.
 *
 *  @return The piece object.
 */
function computePiece(sn, options) {
    if (sn.length < 2 || (sn[0] != '+' && sn[0] != '-')) return;

    //
    // 1. Iterate over slots and build shim coordinates.
    //
    
    var slots = Array(); // Array of slots.
    var nbSlots = sn.length-1;
    var angle = options.trapezoidal ? shimAngle4 : shimAngle3;
    var angleStep = 0; // Rotation steps, each of *angle* radians.
    var upward = (sn[0]=='+') ? 1 : -1; // Whether first shim is pointing upward.
    for (var iSlot = 0; iSlot < nbSlots; iSlot++) {
        // Left tip corner of first shim.
        var p0_tip = {x: 0, y: 0};
            
        // Left base corner of first shim when angle = 0 (vertical).
        var p1_base = {x: 0, y: side*upward};
        
        // Rotation center.
        var center;
        if (options.trapezoidal) {
            center = {x: 0, y: -tipSide*upward};
        } else {
            center = p0_tip;
        }

        var shims = Array();
        slots[iSlot] = {shims: shims, angleStep: angleStep, upward: upward};
        
        // Iterate over shims.
        var nbShims = sn.charCodeAt(iSlot+1)-64; /* A=65 */
        for (var iShim = 0; iShim < nbShims; iShim++) {
            var p0 = rotate(center, p0_tip, angleStep * angle);
            var p1 = rotate(center, p1_base, angleStep * angle);
            angleStep -= upward;
            var p2 = rotate(center, p1_base, angleStep * angle);
            if (options.trapezoidal) {
                var p3 = rotate(center, p0_tip, angleStep * angle);
                shims[iShim] = [p0, p1, p2, p3];
            } else {
                shims[iShim] = [p0, p1, p2];
            }
        }
        
        // Flip orientation of next slot.
        upward = -upward;
    }
    
    //
    // 2. Compute piece height & shift piece vertically.
    //
    
    var height;
    if (options.cropped) {
        // Height = min inner height of all pieces.
        height = Number.POSITIVE_INFINITY;
        for (var iSlot = 0; iSlot < slots.length; iSlot++) {
            var slot = slots[iSlot];
            var maxTip = Number.NEGATIVE_INFINITY, minBase = Number.POSITIVE_INFINITY;
            for (var iShim = 0; iShim < slot.shims.length; iShim++) {
                var shim = slot.shims[iShim];
                maxTip = Math.max(maxTip, shim[0].y * slot.upward);
                if (options.trapezoidal) maxTip = Math.max(maxTip, shim[3].y * slot.upward);
                minBase = Math.min(minBase, shim[1].y * slot.upward, shim[2].y * slot.upward);
            }
            height = Math.min(height, Math.abs(maxTip-minBase));

            // Shift piece to align innermost tip with zero.
            for (var iShim = 0; iShim < slot.shims.length; iShim++) {
                var shim = slot.shims[iShim];
                for (var i = 0; i < shim.length; i++) {
                    shim[i].y -= maxTip * slot.upward;
                }
            }
        }
    } else {
        // Height = max outer height of all pieces.
        height = 0;
        for (var iSlot = 0; iSlot < slots.length; iSlot++) {
            var slot = slots[iSlot];
            var minY = Number.POSITIVE_INFINITY, maxY = Number.NEGATIVE_INFINITY;
            for (var iShim = 0; iShim < slot.shims.length; iShim++) {
                var shim = slot.shims[iShim];
                for (var i = 0; i < shim.length; i++) {
                    minY = Math.min(minY, shim[i].y);
                    maxY = Math.max(maxY, shim[i].y);
                }
            }
            height = Math.max(height, maxY-minY);
            
            // Shift piece to align outermost tip with zero.
            for (var iShim = 0; iShim < slot.shims.length; iShim++) {
                var shim = slot.shims[iShim];
                for (var i = 0; i < shim.length; i++) {
                    shim[i].y -= (slot.upward > 0 ? minY : maxY);
                }
            }
        }
    }

    //
    // 3. Align shim tips on bottom side.
    //

    for (var iSlot = 0; iSlot < slots.length; iSlot++) {
        var slot = slots[iSlot];
        for (var iShim = 0; iShim < slot.shims.length; iShim++) {
            var shim = slot.shims[iShim];
            if (slot.upward > 0) continue;
            for (i = 0; i < shim.length; i++) {
                shim[i].y += height;
            }
        }
    }
        
    //
    // 4. Crop shims.
    //
    
    if (options.cropped) {
        // Crop slots by piece height.
        for (var iSlot = 0; iSlot < slots.length; iSlot++) {
            var slot = slots[iSlot];
            for (var iShim = 0; iShim < slot.shims.length; iShim++) {
                var shim = slot.shims[iShim];
                var y1 = (slot.upward > 0 ? 0 : height);
                var y2 = (slot.upward > 0 ? height : 0);
                var p0 = project(shim[0], shim[1], y1);
                var p1 = project(shim[0], shim[1], y2);
                if (options.trapezoidal) {
                    var p2 = project(shim[3], shim[2], y2);
                    var p3 = project(shim[3], shim[2], y1);
                    slot.shims[iShim] = [p0, p1, p2, p3];
                } else {
                    var p2 = project(shim[0], shim[2], y2);
                    slot.shims[iShim] = [p0, p1, p2];
                }
            }
        }
    }
    
    //
    // 5. Build negative spaces according to alignment rules.
    //
    //  - Project previous slot's right side on next slot's tip side
    //  - Project curent slot's left side on tip side
    //  - Shift by distance + negative space.
    //

    for (var iSlot = 1; iSlot < slots.length; iSlot++) {
        var slot = slots[iSlot];
        var y = slot.upward > 0 ? 0 : height;
        var prevSlot = slots[iSlot-1];
        var prevShim = prevSlot.shims[prevSlot.shims.length-1];
        var prevP = project(
            options.trapezoidal ? prevShim[3] : prevShim[0],
            prevShim[2],
            y
        );
        var p = project(slot.shims[0][0], slot.shims[0][1], y);
        var shift = prevP.x - p.x + negativeSpace;
        for (var iShim = 0; iShim < slot.shims.length; iShim++) {
            var shim = slot.shims[iShim];
            for (i = 0; i < shim.length; i++) {
                shim[i].x += shift;
            }
        }
    }
    
    //
    // 6. Compute bounding box.
    //
    
    var x=0, y=0, x2=0, y2=0;
    for (var iSlot = 0; iSlot < slots.length; iSlot++) {
        var slot = slots[iSlot];
        for (var iShim = 0; iShim < slot.shims.length; iShim++) {
            var shim = slot.shims[iShim];
            for (i = 0; i < shim.length; i++) {
                x = Math.min(x, shim[i].x);
                y = Math.min(y, shim[i].y);
                x2 = Math.max(x2, shim[i].x);
                y2 = Math.max(y2, shim[i].y);
            }
        }
    }
    
    return {sn: sn, slots: slots, bbox: {x: x, y: y, x2: x2, y2: y2}};
}

/**
 * Output a piece as SVG.
 *
 *  @param piece        The piece data.
 *  @param element      DOM element for output (optional).
 *
 *  @return Snap object.
 */
function drawSVG(piece, element) {
    var svg = Snap(element);
    svg.clear();
    for (var iSlot = 0; iSlot < piece.slots.length; iSlot++) {
        var slot = piece.slots[iSlot];
        for (var iShim = 0; iShim < slot.shims.length; iShim++) {
            var shim = slot.shims[iShim];
            var coords = Array();
            for (var i = 0; i < shim.length; i++) {
                coords.push(shim[i].x, shim[i].y);
            }
            svg.polygon(coords).attr('class', "shim");
        }
    }
    svg.rect(
        piece.bbox.x, piece.bbox.y,
        piece.bbox.x2-piece.bbox.x,
        piece.bbox.y2-piece.bbox.y
    ).attr('class', "bbox");
    return svg;
}

/**
 * Draw a piece into a PDF document.
 *
 *  @param piece        The piece data.
 *  @param pdf          jsPDF document.
 *  @param scale        Scaling factor.
 *  @param offx, offy   Position of top-left corner.
 */
function drawPDF(piece, pdf, scale, offx, offy) {
    // Line width. Use same for shims and bbox.
    pdf.setLineWidth(0.05*scale);
    
    for (var iSlot = 0; iSlot < piece.slots.length; iSlot++) {
        var slot = piece.slots[iSlot];
        for (var iShim = 0; iShim < slot.shims.length; iShim++) {
            var shim = slot.shims[iShim];
            var lines = Array();
            for (var i = 0; i < shim.length; i++) {
                lines.push([
                    shim[(i+1)%shim.length].x-shim[i].x,
                    shim[(i+1)%shim.length].y-shim[i].y
                ]);
            }
            pdf.lines(
                lines,
                shim[0].x*scale+offx, shim[0].y*scale+offy,
                [scale, scale],
                'D'
            );
            
        }
    }
    pdf.rect(
        piece.bbox.x*scale+offx, piece.bbox.y*scale+offy, 
        (piece.bbox.x2-piece.bbox.x)*scale, (piece.bbox.y2-piece.bbox.y)*scale, 
        'D'
    );
}

/**
 * Generate a multi-page PDF from a set of pieces.
 *
 *
 *  @param pieceOptions     Piece options: cropped, trapezoidal.
 *  @param printOptions     Print options:
 *                          - orient    Orientation ('portrait', 'landscape').
 *                          - format    Page format ('a3', 'a4','a5' ,'letter' ,'legal').
 *                          - sides     Print mode ('single', 'double')
 *                          - margins   Margins in unit values {top, bottom, left, right}
 *                          - padding   Padding between pieces in unit values
 *                          - unit      Base measurement unit ('mm', 'cm', 'in', 'pt')
 *                          - justif    Justification ('left', 'center', 'right')
 *                          - cols      Minimum number of columns per page.
 *                          - rows      Minimum number of rows per page.
 *                          - seedPos   Seed number position ('none', 'header','footer').
 *                          - pagePos   Page number position ('none', 'header','footer').
 *                          - labelPos  Piece S/N label position ('none', 'top','bottom').
 *  @param limits           Output limits:
 *                          - maxPieces        Maximum overall number of pieces to print.
 *                          - maxPiecesPerDoc  Maximum number of pieces per document.
 *                          - maxPagesPerDoc   Maximum number of pages per document.
 *  @param onprogress       Progress callback, called with args (nb, nbPrint, page, nbPages, doc, nbDocs).
 *  @param onfinish         Finish callback.
 */
function piecesToPDF(pieceOptions, printOptions, limits, onprogress, onfinish) {
    // Various sizes.
    // TODO settings
    var fontSizePt = 10; /* pt */
    var margin = 15; /* mm */
    var padding = 10; /* mm */
    
    // Create jsPDF object.
    var pdf = new jsPDF(printOptions.orient, 'mm', printOptions.format);
    pdf.setFontSize(fontSizePt);
    
    // Compute scaling and actual number of rows/cols.
    var availWidth = pdf.internal.pageSize.width - margin*2 - padding*(printOptions.cols-1);
    var availHeight = pdf.internal.pageSize.height - margin*2 - padding*(printOptions.rows-1);
    var w = availWidth / printOptions.cols;
    var h = availHeight / printOptions.rows;
    var scale = Math.min(w/maxWidth, h/maxHeight);
    w = maxWidth*scale;
    h = maxHeight*scale;
    printOptions.cols = Math.floor((pdf.internal.pageSize.width - margin*2 + padding) / (w + padding));
    printOptions.rows = Math.floor((pdf.internal.pageSize.height - margin*2 + padding) / (h + padding));
    
    var nbPiecesPerPage = printOptions.cols*printOptions.rows;
    
    // Actual number of pieces.
    var nbPrint = Math.min(nbSelected, limits.maxPieces);
    
    // Actual number of pages per document.
    var nbPagesPerDoc = Math.min(Math.ceil(limits.maxPiecesPerDoc/nbPiecesPerPage), limits.maxPagesPerDoc);
    
    // Actual number of pages overall.
    var nbPages = Math.ceil(nbPrint/nbPiecesPerPage);
    
    // Actual number of docs.
    var nbDocs = Math.ceil(nbPages/nbPagesPerDoc);
    
    // Draw each piece.
    var col = 0, row = 0, nb = 0, page = 1, firstPage = 1, doc = 1;
    var draw = function(i) {
        // Next column.
        if (nb > 0 && ++col >= printOptions.cols) {
            // Next row.
            col = 0;
            if (++row >= printOptions.rows) {
                // Next page.
                row = 0;
                if ((page % nbPagesPerDoc) == 0) {
                    // Next doc.
                    save();
                    pdf = new jsPDF(printOptions.orient, 'mm', printOptions.format);
                    pdf.setFontSize(fontSizePt);
                    page++;
                    firstPage = page;
                } else {
                    pdf.addPage();
                    page++;
                }
            }
        }
        
        // Compute offset in gridded layout.
        var offx = margin + (w + padding) * col;
        var offy = margin + (h + padding) * row;
        
        // Output piece at the right place.
        var sn = generatePermutation(i, c, x, y)
        var piece = computePiece(sn, pieceOptions);
        drawPDF(piece, pdf, scale, offx, offy);
        
        // Output label.
        switch (printOptions.labelPos) {
            case 'top':
                pdf.text(offx, offy - 1, sn);
                // TODO alignment pdf.text(offx + pdf.getStringUnitWidth(sn) * fontSizePt / pdf.internal.scaleFactor, offy - 1, "toto");
                break;
            case 'bottom':
                pdf.text(offx, offy + h + fontSizePt / pdf.internal.scaleFactor, sn);
                break;
        }
        nb++;
    }
    var save = function() {
        // Save current PDF document.
        saveAs(new Blob([pdf.output()], {type: 'application/pdf'}), x+"-"+y+"-"+seed+"."+firstPage+"-"+page+".pdf");
        onprogress(nb, nbPrint, page, nbPages, doc, nbDocs);
        doc++;
    }
    
    if (defaultSelected) {
        // All pieces but toggled ones.
        var i = 0;
        var step = 100;
        var drawBg = function() {
            for (; i < nbPieces; i++) {
                if (pieceToggle[i]) continue;
                draw(i);

                if (nb >= nbPrint) {
                    save();
                    setTimeout(onfinish, 0);
                    return;
                }
                
                if ((nb % step) == 0) {
                    onprogress(nb, nbPrint, page, nbPages, doc, nbDocs);
                    setTimeout(drawBg, 0);
                    i++;
                    break;
                }
            }
        }
        drawBg();
    } else {
        // Only toggled pieces
        // Note: no progress here, we expect the number of pieces to be small.
        for (var i in pieceToggle) {
            draw(parseInt(i));

            if (nb >= nbPrint) {
                save();
                setTimeout(onfinish, 0);
                return;
            }
        }
    }
}

/**
 * Generate a Zip archive of SVG files from a set of pieces.
 *
 *  @param pieceOptions     Piece options: cropped, trapezoidal.
 *  @param limits           Output limits:
 *                          - maxPieces        Maximum overall number of pieces to export.
 *                          - maxPiecesPerZip  Maximum number of pieces per Zip file.
 *  @param onprogress       Progress callback, called with args (nb, nbPrint, page, nbPages, doc, nbDocs).
 *  @param onfinish         Finish callback.
 */
function piecesToZip(pieceOptions, limits, onprogress, onfinish) {
    // Create JSZip object.
    var zip = new JSZip();
    
    // Actual number of pieces.
    var nbSvg = Math.min(nbSelected, limits.maxPieces);
    
    // Actual number of Zip files.
    var nbFiles = Math.ceil(nbSvg/limits.maxPiecesPerZip);
    
    // Output each piece as SVG file.
    var svgTmp = $("#tmpSvg svg")[0];
    var nb = 0, file = 1;
    var generateSvg = function(i) {
        if (nb > 0 && (nb % limits.maxPiecesPerZip) == 0) {
            // Next file.
            save();
            zip = new JSZip();
        }
        
        // Generate SVG from piece.
        var sn = generatePermutation(i, c, x, y)
        var piece = computePiece(sn, pieceOptions);
        var svg = drawSVG(piece, svgTmp);
        svg.attr('viewBox', 
            piece.bbox.x 
            + " " + piece.bbox.y 
            + " " 
            + (piece.bbox.x2-piece.bbox.x) 
            + " " 
            + (piece.bbox.y2-piece.bbox.y)
        );
        svg.attr({fill: 'none', stroke: 'black', strokeWidth: 0.1});
        
        // Add SVG to Zip file.
        zip.file(sn + ".svg", svg.outerSVG());
        nb++;
    }
    var save = function() {
        saveAs(zip.generate({type: 'blob', compression: 'DEFLATE'}), x+"-"+y+"-"+seed+((nbFiles > 1) ? "."+file : "")+".zip");
        onprogress(nb, nbSvg, undefined, undefined, file, nbFiles);
        file++;
    }
    
    if (defaultSelected) {
        // All pieces but toggled ones.
        var i = 0;
        var step = 100;
        var generateBg = function() {
            for (; i < nbPieces; i++) {
                if (pieceToggle[i]) continue;
                generateSvg(i);

                if (nb >= nbSvg) {
                    save();
                    setTimeout(onfinish, 0);
                    return;
                }
                
                if ((nb % step) == 0) {
                    onprogress(nb, nbSvg, undefined, undefined, file, nbFiles);
                    setTimeout(generateBg, 0);
                    i++;
                    break;
                }
            }
        }
        generateBg();
    } else {
        // Only toggled pieces
        // Note: no progress here, we expect the number of pieces to be small.
        for (var i in pieceToggle) {
            generateSvg(parseInt(i));

            if (nb >= nbSvg) {
                save();
                setTimeout(onfinish, 0);
                return;
            }
        }
    }
}


/*
 *
 * Interface functions.
 *
 */

/** Handles. */
var x, y;

/** Maximum theoretical piece width/height. */
var maxWidth, maxHeight;

/** Number of generated pieces. */
var nbPieces;

/** Permutation seed. */
var seed;

/** LCG increment value generated from seed. */
var c;

/** Columns and rows to display. */
var columns, rows;

/** Column class for piece elements. */
var colClass;

/** Paging. */
var nbPages, nbPerPage;

/** Default selection state. */
var defaultSelected;

/** Piecewise selection toggle state. */
var pieceToggle;

/** Number of toggled pieces. We can't rely on pieceToggle.length because JS 
 *  may switch between vector and object for sparse array storage. */
var nbToggle;

/** Number of selected pieces. */
var nbSelected;

/**
 * Validation for number inputs. Replace the input value with a reasonable
 * number:
 *
 *  - floating point strings are rounded to the nearest step value toward zero.
 *  - final value is kept between min and max.
 *  - non-numeric strings are replaced by zero or the min value.
 */
function validateNumber() {
    var min = $(this).attr('min'); if (!$.isNumeric(min)) min = Number.NEGATIVE_INFINITY;
    var max = $(this).attr('max'); if (!$.isNumeric(max)) max = Number.POSITIVE_INFINITY;
    var step = $(this).attr('step'); if (!$.isNumeric(step)) step = 1;
    this.value = parseFloat((Math.round(parseFloat(this.value)/step)*step).toPrecision(12));
    this.value = Math.max(min, Math.min(max, this.value));
}

/**
 * Ensure that permutation is not too large. Else disable interface elements.
 */ 
function validatePermutationSize() {
    var x = parseInt($("#x").val());
    var y = parseInt($("#y").val());
    var nbPieces = 2*Math.pow(x,y);
    if (nbPieces > Number.MAX_SAFE_INTEGER) {
        // Permutation too large.
        $("#generate").removeClass("btn-default").addClass("btn-danger").prop('disabled', true);
        $("#x, #y").parent().addClass("has-error bg-danger");
        $("#message").addClass("panel-body").html("<div class='alert alert-danger'><span class='glyphicon glyphicon-warning-sign'></span> Permutation size too large!</div>");
    } else {
        $("#generate").removeClass("btn-danger").addClass("btn-primary").prop('disabled', false);
        $("#x, #y").parent().removeClass("has-error bg-danger");
        $("#message").removeClass("panel-body").empty();
    }
}

/**
 * Generate a new set of pieces.
 */
function generatePieces() {
    $("#zip").prop('disabled', false);
    $("#print").prop('disabled', false);

    // Get algorithm handles.
    x = parseInt($("#x").val());
    y = parseInt($("#y").val());

    // Number of pieces to generate.
    nbPieces = parseInt($("#nbPieces").val());
    if ($("#max").prop('checked')) {
        // Use max number of pieces.
        nbPieces = 2*Math.pow(x,y);
    }
    
    // Maximum theoretical piece width/height.
    maxWidth = Math.ceil(y/2)*x + (negativeSpace+tip)*(y-1);
    maxHeight = side+tip;

    // Get/generate seed.
    if ($("#random").prop('checked')) {
        // Generate random seed.
        seed = Math.floor(Math.random() * (MAX_SEED+1));
        $("#seed").val(seed);
    }
    seed = parseInt($("#seed").val());
    seed %= (MAX_SEED+1);
    
    // LCG increment value.
    c = lcg_increment(seed);
    
    // Set default selection state.
    defaultSelected = true;
    pieceToggle = Array();
    nbToggle = 0;
    updateSelected();
    
    // Adjust column layout.
    columns = parseInt($("#columns").val());
    switch (columns) {
        case 0:
            // Automatic, use 4-column responsive layout.
            columns = 4;
            colClass = "col-xs-12";
            if (nbPieces >= 2) {
                colClass += " col-sm-6";
            }
            if (nbPieces >= 3) {
                colClass += " col-md-4";
            }
            if (nbPieces >= 4) {
                colClass += " col-lg-3";
            }
            break;
            
        case 1:
            colClass = "col-xs-12";
            break;
            
        case 2:
            colClass = "col-xs-12 col-sm-6";
            break;
            
        case 3:
            colClass = "col-xs-12 col-sm-4";
            break;
            
        case 4:
            colClass = "col-xs-12 col-sm-3";
            break;
            
        case 6:
            colClass = "col-xs-12 col-sm-2";
            break;
    }
    rows = parseInt($("#rows").val());
    
    // Paging.
    nbPerPage = columns*rows;
    nbPages = Math.ceil(nbPieces/nbPerPage);

    // Display first page
    displayPieces(0);
}

/** 
 * Display pieces for a given page.
 *
 *  @param page     Page number (zero-indexed).
 */
function displayPieces(page) {
    // Sanity check.
    page = Math.max(0, Math.min(page, nbPages-1));
    
    // Display toolbar.
    $("#toolbar").removeClass("hidden");
    
    // Display pager.
    var $pager = $("#pager");
    $pager.empty();
    if (nbPages > 1) {
        var pager = "<ul class='pagination pagination-sm'>";
        pager += "<li" + (page==0?" class='disabled'":"") + "><a href='javascript:displayPieces(" + Math.max(0,page-1) + ")'>&laquo;</a></li>";
        for (var i = 0; i < nbPages; i++) {
            if (nbPages > 10) {
                // Limit buttons to 10, add ellipses for missing buttons.
                if (page < 5) {
                    if (i == 8) {
                        // Ellipsis at end.
                        pager += "<li class='disabled'><span>...</span></li>";
                        i = nbPages-2;
                        continue;
                    }
                } else if (page >= nbPages-5) {
                    if (i == 1) {
                        // Ellipsis at beginning.
                        pager += "<li class='disabled'><span>...</span></li>";
                        i = nbPages-9;
                        continue;
                    }
                } else {
                    if (i == 1) {
                        // Ellipsis at beginning.
                        pager += "<li class='disabled'><span>...</span></li>";
                        i = page-3;
                        continue;
                    } else if (i == page+3) {
                        // Ellipsis at end.
                        pager += "<li class='disabled'><span>...</span></li>";
                        i = nbPages-2;
                        continue;
                    }
                }
            }
            pager += "<li" + (i==page?" class='active'":"") + "><a href='javascript:displayPieces(" + i + ")'>" + (i+1) + "</a></li>";
        }
        pager += "<li" + (page==nbPages-1?" class='disabled'":"") + "><a href='javascript:displayPieces(" + Math.min(page+1,nbPages-1) + ")'>&raquo;</a></li>";
        pager += "</ul>";
        $pager.append(pager);
    }    
    
    // Clear existing pieces.
    var $pieces = $("#pieces");
    $pieces.empty();
    
    // Generate piece output elements.
    var begin = nbPerPage*page;
    var end = Math.min(begin+nbPerPage, nbPieces);
    for (var i = begin; i < end; i++) {
        // Selection state.
        var selected = defaultSelected;
        if (pieceToggle[i]) selected = !selected;
        
        var piece = "<div id='piece-" + i + "' class='form-inline piece " + colClass + "'>";
        piece += "<div class='thumbnail'>";
        piece += "<input id='piece-select-" + i + "' class='piece-select' data-piece='" + i + "' type='checkbox' onclick='togglePiece(" + i + ")' " + (selected?" checked":"") + "/> ";
        piece += "<label for='piece-select-" + i + "'>";
        piece += "<svg xmlns='http://www.w3.org/2000/svg' version='1.1'></svg><br/>";
        piece += "</label>";
        piece += "<div class='input-group input-group-sm'>";
        piece += "<input type='text' class='form-control sn' readonly placeholder='Piece S/N' value='" + generatePermutation(i, c, x, y) + "' size='" + y + "'/>";
        piece += "<span class='input-group-btn'><button type='button' class='btn btn-default' onclick='downloadSVG($(this).parent().parent().find(\".sn\").val().trim())'><span class='glyphicon glyphicon-download'></span> SVG</button></span>"
        piece += "</div>";
        piece += "</div>";
        piece += "</div>";
        $pieces.append(piece);
    }
    
    // Display pieces.
    $pieces.find(".piece").each(function(index, element) {
        updatePiece(element);
    });
}

/**
 * Update existing piece when some parameter changes (e.g. cropping).
 */
function updatePieces() {
    $("#pieces .piece").each(function(index, element) {
        updatePiece(element);
    });
}

/**
 * Compute & output piece from its S/N.
 *
 *  @param element    The containing element.
 */
function updatePiece(element) {
    var sn = $(element).find(".sn").val().trim();
    
    // Generate piece.
    var piece = computePiece(sn, {
        cropped: $("#cropped").prop('checked'), 
        trapezoidal:$("#trapezoidal").prop('checked')
    });
    
    // Output to SVG.
    var svg = drawSVG(piece, $(element).find("svg")[0]);
    
    // Adjust viewbox so that all pieces are centered and use the same scale.
    svg.attr('viewBox', 
        ((piece.bbox.x2-piece.bbox.x)-maxWidth)/2
        + " "
        + ((piece.bbox.y2-piece.bbox.y)-maxHeight)/2
        + " " + maxWidth + " " + maxHeight);
}

/**
 * Toggle select state of given piece.
 *
 *  @param piece    Piece number to toggle.
 */
function togglePiece(piece) {
    if (pieceToggle[piece]) {
        delete pieceToggle[piece];
        nbToggle--;
    } else {
        pieceToggle[piece] = true;
        nbToggle++;
    }
    updateSelected();
    
}

/**
 * Check/uncheck visible pieces.
 *
 *  @param  check   Whether to check or uncheck pieces.
 */
function checkVisible(check) {
    $(".piece-select").each(function(index, element) {
        if (element.checked^check) {
            $(element).click();
        }
    });
}

/**
 * Check/uncheck all pieces.
 *
 *  @param  check   Whether to check or uncheck pieces.
 */
function checkAll(check) {
    checkVisible(check);
    defaultSelected = check;
    nbToggle = 0;
    pieceToggle = Array();
    updateSelected();
}

/**
 * Update selected piece counters.
 */
function updateSelected() {
    nbSelected = (defaultSelected ? nbPieces - nbToggle : nbToggle);
    $("#totalPieces").html(nbPieces);
    $("#selectedPieces").html(nbSelected);
    $("#zip").prop('disabled', (nbSelected == 0));
    $("#print").prop('disabled', (nbSelected == 0));
}

/**
 * Download piece as SVG.
 *
 *  @param sn   The piece serial number.
 */
function downloadSVG(sn) {
    // Generate piece.
    var piece = computePiece(sn, {
        cropped: $("#cropped").prop('checked'), 
        trapezoidal:$("#trapezoidal").prop('checked')
    });
    
    // Output to SVG.
    var svg = drawSVG(piece, $("#tmpSvg svg")[0]);
    svg.attr('viewBox', 
        piece.bbox.x 
        + " " + piece.bbox.y 
        + " " 
        + (piece.bbox.x2-piece.bbox.x) 
        + " " 
        + (piece.bbox.y2-piece.bbox.y)
    );
    svg.attr({fill: 'none', stroke: 'black', strokeWidth: 0.1});

    blob = new Blob([svg.outerSVG()], {type: "image/svg+xml"});
    saveAs(blob, sn + ".svg");
    
} 

/**
 * Update progress information during PDF output.
 *
 *  @param ratio    Progress ratio [0,1].
 *  @param piece    Number of pieces output so far.
 *  @param nbPieces Total number of pieces (optional).
 *  @param page     Number of pages output so far (optional).
 *  @param nbPages  Total number of pages (optional).
 *  @param doc      Number of documents output so far (optional).
 *  @param nbDocs   Total number of documents (optional).
 */
function progress(piece, nbPieces, page, nbPages, doc, nbDocs) {
    var percent = (piece/nbPieces)*100;
    $("#progress .progress-bar").attr('aria-valuenow', percent).attr('style','width:'+percent.toFixed(2)+'%').find("span").html(percent.toFixed(0) + "%)");
    $("#progressPiece").html("Piece " + piece + "/" + nbPieces);
    $("#progressPage").html((page && nbPages) ? "Page " + page + "/" + nbPages : "");
    $("#progressDoc").html((doc && nbDocs) ? "Document " + doc + "/" + nbDocs : "");
}

/**
 * Output pieces to PDF.
 */
function downloadPDF() {
    $("#printDialog").modal('hide');
    $("#progressDialog").modal('show');
    piecesToPDF(
        {
            cropped: $("#cropped").prop('checked'),
            trapezoidal: $("#trapezoidal").prop('checked')
        },
        {
            orient: $("[name='orient']:checked").val(), 
            format: $("[name='format']:checked").val(),
            sides: $("[name='sides']:checked").val(),

            margins: {
                top: $("#marginTop").val(),
                bottom: $("#marginBottom").val(),
                left: $("#marginLeft").val(),
                right: $("#marginRight").val(),
            },
            padding: $("#padding").val(),
            unit: $("#unit").val(),
            
            justif: $("[name='justif']:checked").val(),
            cols: $("#printColumns").val(),
            rows: $("#printRows").val(),
            
            seedPos: $("[name='seedPos']:checked").val(),
            pagePos: $("[name='pagePos']:checked").val(),
            labelPos: $("[name='labelPos']:checked").val(),
        },
        {
            maxPieces: $("#maxPieces").val(),
            maxPiecesPerDoc: $("#maxPiecesPerDoc").val(),
            maxPagesPerDoc: $("#maxPagesPerDoc").val(),
        },
        progress,
        function() {$("#progressDialog").modal('hide');}
    );
}

/**
 * Output pieces to zipped SVG.
 */
function downloadZip() {
    $("#zipDialog").modal('hide');
    $("#progressDialog").modal('show');
    piecesToZip(
        {
            cropped: $("#cropped").prop('checked'),
            trapezoidal: $("#trapezoidal").prop('checked')
        },
        {
            maxPieces: $("#maxZip").val(),
            maxPiecesPerZip: $("#maxPiecesPerZip").val()
        },
        progress,
        function() {$("#progressDialog").modal('hide');}
    );
}
